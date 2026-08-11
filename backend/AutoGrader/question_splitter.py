"""
Question detection and splitting for AutoGrader.

Provides functionality to split PDF/images into individual question pages,
following patterns learned from learning_resources.py.
"""

import base64
import io
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF
from PIL import Image

from deps import create_chat_completion_async
from .models import QuestionAnswerPdfPair
from .prompt_loader import get_prompt, render_prompt


class QuestionDetector:
    """Detect question boundaries in a PDF page using heuristics and/or LLM."""

    @staticmethod
    def _image_to_b64(img: Image.Image, quality: int | None = None) -> str:
        try:
            max_dimension = max(640, int(os.getenv("AUTOGRADER_LAYOUT_MAX_DIMENSION", "1280")))
        except ValueError:
            max_dimension = 1280
        try:
            jpeg_quality = int(os.getenv("AUTOGRADER_LAYOUT_JPEG_QUALITY", "78"))
        except ValueError:
            jpeg_quality = 78
        if quality is not None:
            jpeg_quality = quality

        working = img.convert("RGB")
        if max(working.size) > max_dimension:
            working = working.copy()
            working.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        working.save(buf, format="JPEG", quality=max(40, min(95, jpeg_quality)), optimize=True)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    @staticmethod
    def normalize_question_label(label: str) -> str:
        """Normalize labels like '(Q5)' / 'q5' / '5' to a stable key for pairing."""
        raw = str(label or "").strip().lower()
        raw = re.sub(r"[^a-z0-9]+", "", raw)
        if raw.startswith("q") and len(raw) > 1:
            raw = raw[1:]
        return raw or "unknown"

    @staticmethod
    def detect_by_heuristic(text: str, page_height_pt: float = 792.0) -> List[Dict[str, Any]]:
        """
        Detect questions using regex patterns on extracted text.
        
        Recognizes common numbering formats:
        - "1.", "2.", "3." (standard)
        - "(1)", "(2)", "(a)", "(b)" (parenthetical)
        - "Problem 1:", "Q1:" (word-based)
        
        Returns list of question info with estimated vertical positions.
        """
        lines = text.split("\n")
        questions: List[Dict[str, Any]] = []
        
        # Pattern matching for question numbers
        patterns = [
            r"^\s*(\d+)\.\s+",  # "1. " at line start
            r"^\s*\((\d+)\)\s+",  # "(1) " at line start
            r"^\s*\(([a-z])\)\s+",  # "(a) " at line start
            r"^\s*(?:Problem|Question|Q\.?)\s*(\d+):",  # "Problem 1:" style
        ]
        
        for line_idx, line in enumerate(lines):
            for pattern in patterns:
                match = re.match(pattern, line.strip(), re.IGNORECASE)
                if match:
                    q_num = match.group(1)
                    # Estimate vertical position based on line index
                    # (naive: assuming ~12pt per line)
                    estimated_y = line_idx * 12
                    questions.append({
                        "number": q_num,
                        "line_index": line_idx,
                        "estimated_y": estimated_y,
                        "text_start": line[:80],
                    })
        
        return questions

    @staticmethod
    async def detect_layout_and_questions_with_llm(
        image_candidates: Dict[str, Image.Image],
    ) -> Optional[Dict[str, Any]]:
        """One LLM call: pick best orientation and return question boundaries on that orientation."""
        system_msg = get_prompt("question_splitter.single_page.system")
        user_msg = get_prompt("question_splitter.single_page.user")

        content: list[dict[str, Any]] = [{"type": "text", "text": user_msg}]
        for label in ["r0", "r90", "r180", "r270"]:
            if label not in image_candidates:
                continue
            content.append(
                {
                    "type": "text",
                    "text": render_prompt(
                        "question_splitter.single_page.candidate_label",
                        orientation=label,
                    ),
                }
            )
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{QuestionDetector._image_to_b64(image_candidates[label])}"},
                }
            )

        try:
            resp = await create_chat_completion_async(
                model=os.getenv("AUTOGRADER_MODEL", "gpt-5.2"),
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": content},
                ],
                temperature=0.0,
                required_capabilities={"json"},
            )
            raw = (resp.choices[0].message.content or "").strip()
            if raw.startswith("```"):
                raw = raw.split("```", 1)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw)
        except Exception as e:
            print(f"[QuestionDetector] layout+question LLM failed: {e}")
            return None

    @staticmethod
    async def detect_question_answer_layout_with_llm(
        question_candidates: Dict[str, Image.Image],
        answer_candidates: Dict[str, Image.Image],
    ) -> Optional[Dict[str, Any]]:
        """One LLM call: detect best orientations and question regions for both question and answer pages."""
        system_msg = get_prompt("question_splitter.paired_pages.system")
        user_msg = get_prompt("question_splitter.paired_pages.user")

        content: list[dict[str, Any]] = [{"type": "text", "text": user_msg}]
        for label in ["r0", "r90", "r180", "r270"]:
            if label in question_candidates:
                content.append(
                    {
                        "type": "text",
                        "text": render_prompt(
                            "question_splitter.paired_pages.question_candidate_label",
                            orientation=label,
                        ),
                    }
                )
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{QuestionDetector._image_to_b64(question_candidates[label])}"},
                    }
                )
        for label in ["r0", "r90", "r180", "r270"]:
            if label in answer_candidates:
                content.append(
                    {
                        "type": "text",
                        "text": render_prompt(
                            "question_splitter.paired_pages.answer_candidate_label",
                            orientation=label,
                        ),
                    }
                )
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{QuestionDetector._image_to_b64(answer_candidates[label])}"},
                    }
                )

        try:
            resp = await create_chat_completion_async(
                model=os.getenv("AUTOGRADER_MODEL", "gpt-5.2"),
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": content},
                ],
                temperature=0.0,
                required_capabilities={"json"},
            )
            raw = (resp.choices[0].message.content or "").strip()
            if raw.startswith("```"):
                raw = raw.split("```", 1)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw)
        except Exception as e:
            print(f"[QuestionDetector] question+answer layout LLM failed: {e}")
            return None


class QuestionSplitter:
    """Split PDF pages into individual question regions."""

    @staticmethod
    def image_to_pdf_bytes(image: Image.Image) -> bytes:
        """Convert a PIL image into a single-page PDF."""
        if image.mode != "RGB":
            image = image.convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="PDF")
        return buffer.getvalue()

    @staticmethod
    def _find_content_vertical_bounds(
        image: Image.Image,
        y_start: float,
        y_end: float,
        *,
        white_threshold: int = 245,
        min_row_density: float = 0.006,
        min_dark_pixels: int = 4,
        consecutive_rows: int = 2,
        horizontal_margin_percent: float = 2.0,
    ) -> Optional[Tuple[int, int]]:
        """Find the vertical bounds of visible content inside a candidate crop."""
        page_width, page_height = image.size
        top = max(0, min(page_height, int(y_start)))
        bottom = max(0, min(page_height, int(y_end)))
        if bottom <= top:
            return None

        gray = image.crop((0, top, page_width, bottom)).convert("L")
        width, height = gray.size
        if width <= 0 or height <= 0:
            return None

        pixels = gray.load()
        margin = int(width * (horizontal_margin_percent / 100.0))
        x_start = max(0, min(width - 1, margin))
        x_end = max(x_start + 1, min(width, width - margin))
        scan_width = x_end - x_start
        active_rows: list[int] = []
        for row in range(height):
            dark_count = 0
            for col in range(x_start, x_end):
                if pixels[col, row] < white_threshold:
                    dark_count += 1
            if dark_count >= min_dark_pixels and (dark_count / scan_width) >= min_row_density:
                active_rows.append(row)

        if not active_rows:
            return None

        def expand_to_stable_edge(start_index: int, direction: int) -> int:
            row = active_rows[start_index]
            empty_streak = 0
            while 0 <= row + direction < height:
                row += direction
                dark_count = 0
                for col in range(x_start, x_end):
                    if pixels[col, row] < white_threshold:
                        dark_count += 1
                if dark_count >= min_dark_pixels and (dark_count / scan_width) >= min_row_density:
                    empty_streak = 0
                    continue
                empty_streak += 1
                if empty_streak >= consecutive_rows:
                    return row - (direction * consecutive_rows)
            return row

        content_top = expand_to_stable_edge(0, -1)
        content_bottom = expand_to_stable_edge(len(active_rows) - 1, 1)
        if content_bottom <= content_top:
            return None

        return top + content_top, top + content_bottom

    @staticmethod
    def split_image_by_questions(
        image: Image.Image,
        questions: List[Dict[str, Any]],
        *,
        footer_cutoff_percent: float = 98.5,
        top_padding_pt: float = 14.0,
        bottom_padding_pt: float = 14.0,
        min_crop_height_pt: float = 180.0,
        upward_overlap_percent: float = 4.0,
        upward_overlap_max_pt: float = 140.0,
        bottom_question_threshold_percent: float = 80.0,
        bottom_question_extra_up_percent: float = 8.0,
        last_question_extra_up_percent: float = 9.0,
        visual_trim_enabled: bool = True,
        visual_padding_pt: float = 24.0,
        candidate_expand_top_percent: float = 1.5,
        candidate_expand_bottom_percent: float = 4.0,
        max_visual_top_shift_pt: float = 48.0,
        white_threshold: int = 245,
        min_row_density: float = 0.006,
        horizontal_margin_percent: float = 2.0,
        min_visual_content_height_pt: float = 40.0,
        min_visual_content_ratio: float = 0.08,
    ) -> List[bytes]:
        """Split a rotated page image into one PDF per question, then trim blank vertical margins."""
        if not questions:
            return []

        page_width, page_height = image.size

        def to_float(value: Any, default: float) -> float:
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        sorted_questions = sorted(
            questions,
            key=lambda q: to_float(q.get("top_percent", q.get("vertical_percent", 0.0)), 0.0),
        )

        output_pdfs: List[bytes] = []
        for index, question in enumerate(sorted_questions):
            top_percent = to_float(question.get("top_percent", question.get("vertical_percent", 0.0)), 0.0)
            bottom_percent = question.get("bottom_percent")
            next_top_percent: Optional[float] = None

            if bottom_percent is None:
                if index + 1 < len(sorted_questions):
                    next_top = to_float(
                        sorted_questions[index + 1].get("top_percent", sorted_questions[index + 1].get("vertical_percent", 100.0)),
                        100.0,
                    )
                    next_top_percent = next_top
                    bottom_percent = next_top - 1.0
                else:
                    bottom_percent = footer_cutoff_percent
            else:
                bottom_percent = to_float(bottom_percent, footer_cutoff_percent)
                if index + 1 < len(sorted_questions):
                    next_top_percent = to_float(
                        sorted_questions[index + 1].get("top_percent", sorted_questions[index + 1].get("vertical_percent", 100.0)),
                        100.0,
                    )

            top_percent = max(0.0, min(99.0, top_percent))
            bottom_percent = max(0.0, min(footer_cutoff_percent, bottom_percent))
            if next_top_percent is not None:
                bottom_percent = min(bottom_percent, max(top_percent + 1.0, next_top_percent - 0.5))
            if bottom_percent <= top_percent:
                bottom_percent = min(footer_cutoff_percent, top_percent + 5.0)

            y_start = max(0.0, (top_percent / 100.0) * page_height - top_padding_pt)
            y_end = min(page_height, (bottom_percent / 100.0) * page_height + bottom_padding_pt)

            if index > 0:
                upward_extra = min(page_height * (upward_overlap_percent / 100.0), upward_overlap_max_pt)
                y_start = max(0.0, y_start - upward_extra)

            if top_percent >= bottom_question_threshold_percent:
                y_start = max(0.0, y_start - page_height * (bottom_question_extra_up_percent / 100.0))

            if index == len(sorted_questions) - 1 and top_percent >= bottom_question_threshold_percent:
                y_start = max(0.0, y_start - page_height * (last_question_extra_up_percent / 100.0))

            if visual_trim_enabled:
                expanded_start = max(
                    0.0,
                    y_start - page_height * (candidate_expand_top_percent / 100.0),
                )
                expanded_end = min(
                    page_height,
                    y_end + page_height * (candidate_expand_bottom_percent / 100.0),
                )
                if next_top_percent is not None:
                    next_top_y = max(0.0, min(page_height, (next_top_percent / 100.0) * page_height))
                    expanded_end = min(expanded_end, max(y_end, next_top_y - bottom_padding_pt))

                content_bounds = QuestionSplitter._find_content_vertical_bounds(
                    image,
                    expanded_start,
                    expanded_end,
                    white_threshold=white_threshold,
                    min_row_density=min_row_density,
                    horizontal_margin_percent=horizontal_margin_percent,
                )
                if content_bounds is not None:
                    content_top, content_bottom = content_bounds
                    content_height = content_bottom - content_top
                    candidate_height = expanded_end - expanded_start
                    if (
                        content_height >= min_visual_content_height_pt
                        and content_height >= candidate_height * min_visual_content_ratio
                    ):
                        if content_top >= y_start - max_visual_top_shift_pt:
                            y_start = max(0.0, content_top - visual_padding_pt)
                        y_end = min(page_height, content_bottom + visual_padding_pt)

            if (y_end - y_start) < min_crop_height_pt:
                y_end = min(page_height, y_start + min_crop_height_pt)

            crop_box = (0, int(y_start), page_width, int(y_end))
            crop = image.crop(crop_box)
            output_pdfs.append(QuestionSplitter.image_to_pdf_bytes(crop))

        return output_pdfs

    @staticmethod
    def split_image_by_questions_with_labels(
        image: Image.Image,
        questions: List[Dict[str, Any]],
    ) -> List[Tuple[str, bytes]]:
        """Split image and keep label for each cropped PDF."""
        if not questions:
            return []

        # Keep the same ordering rule as splitter.
        def to_float(value: Any, default: float) -> float:
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        sorted_questions = sorted(
            questions,
            key=lambda q: to_float(q.get("top_percent", q.get("vertical_percent", 0.0)), 0.0),
        )

        pdfs = QuestionSplitter.split_image_by_questions(image, sorted_questions)
        labeled: List[Tuple[str, bytes]] = []
        for index, pdf_bytes in enumerate(pdfs):
            label = str(sorted_questions[index].get("label", f"q{index + 1}"))
            labeled.append((label, pdf_bytes))
        return labeled

    @staticmethod
    def combine_images_to_pdf(image_list: List[bytes]) -> bytes:
        """
        Combine multiple images into a single PDF.
        
        Args:
            image_list: List of image bytes (PNG, JPEG, etc.)
        
        Returns:
            PDF bytes with one page per image
        """
        from PIL import Image
        import io
        
        doc = fitz.open()
        
        for img_bytes in image_list:
            try:
                # Open image
                pil_img = Image.open(io.BytesIO(img_bytes))
                
                # Create PDF page
                page = doc.new_page(width=pil_img.width, height=pil_img.height)
                
                # Convert PIL to fitz pixmap
                if pil_img.mode != "RGB":
                    pil_img = pil_img.convert("RGB")
                
                insert_rect = fitz.Rect(0, 0, pil_img.width, pil_img.height)
                page.insert_image(insert_rect, stream=img_bytes)
            except Exception as e:
                print(f"[QuestionSplitter] Failed to insert image: {e}")
                continue
        
        pdf_bytes = doc.write()
        doc.close()
        return pdf_bytes

    @staticmethod
    def pdf_first_page_height(pdf_bytes: bytes) -> float:
        """Return the height of the first PDF page."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            return float(doc[0].rect.height)
        finally:
            doc.close()


class DocumentSplitter:
    """
    High-level interface: split a DocumentBundle into per-question bundles.
    """

    @staticmethod
    async def split_pdf_by_questions(
        pdf_bytes: bytes,
        detection_method: str = "heuristic",
    ) -> List[bytes]:
        """
        Split a PDF into individual question PDFs.
        
        Args:
            pdf_bytes: The input PDF
            detection_method: "heuristic" or "llm"
        
        Returns:
            List of PDF bytes, one per question
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_question_pdfs: List[bytes] = []
        
        for page_num in range(1, len(doc) + 1):
            page = doc[page_num - 1]
            
            # Detect questions
            if detection_method == "llm":
                pix = page.get_pixmap(dpi=120)
                base_image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
                candidates = {
                    "r0": base_image,
                    "r90": base_image.rotate(90, expand=True),
                    "r180": base_image.rotate(180, expand=True),
                    "r270": base_image.rotate(270, expand=True),
                }
                detected = await QuestionDetector.detect_layout_and_questions_with_llm(candidates)
                questions = detected.get("questions", []) if detected else []
                best_orientation = str(detected.get("best_orientation", "r0")).lower() if detected else "r0"
                selected_image = candidates.get(best_orientation, base_image)
            else:
                # Use heuristic
                text = str(page.get_text())
                questions = QuestionDetector.detect_by_heuristic(text)
                selected_image = Image.open(io.BytesIO(page.get_pixmap(dpi=120).tobytes("png"))).convert("RGB")
            
            if not questions:
                # No questions detected on this page, add whole page as a raster PDF.
                all_question_pdfs.append(QuestionSplitter.image_to_pdf_bytes(selected_image))
            else:
                # Split page by questions
                question_pdfs = QuestionSplitter.split_image_by_questions(
                    selected_image,
                    questions,
                )
                all_question_pdfs.extend(question_pdfs)
        
        doc.close()
        return all_question_pdfs

    @staticmethod
    async def split_pdf_by_questions_with_labels(
        pdf_bytes: bytes,
        detection_method: str = "llm",
    ) -> List[Tuple[str, bytes]]:
        """Split a PDF and return labeled question crops."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_parts: List[Tuple[str, bytes]] = []

        for page_num in range(1, len(doc) + 1):
            page = doc[page_num - 1]
            if detection_method == "llm":
                pix = page.get_pixmap(dpi=120)
                base_image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
                candidates = {
                    "r0": base_image,
                    "r90": base_image.rotate(90, expand=True),
                    "r180": base_image.rotate(180, expand=True),
                    "r270": base_image.rotate(270, expand=True),
                }
                detected = await QuestionDetector.detect_layout_and_questions_with_llm(candidates)
                questions = detected.get("questions", []) if detected else []
                best_orientation = str(detected.get("best_orientation", "r0")).lower() if detected else "r0"
                selected_image = candidates.get(best_orientation, base_image)
            else:
                text = str(page.get_text())
                questions = QuestionDetector.detect_by_heuristic(text)
                selected_image = Image.open(io.BytesIO(page.get_pixmap(dpi=120).tobytes("png"))).convert("RGB")

            if not questions:
                all_parts.append((f"page_{page_num}", QuestionSplitter.image_to_pdf_bytes(selected_image)))
                continue

            labeled_parts = QuestionSplitter.split_image_by_questions_with_labels(selected_image, questions)
            all_parts.extend(labeled_parts)

        doc.close()
        return all_parts

    @staticmethod
    async def build_question_answer_pairs(
        question_pdf_bytes: bytes,
        answer_pdf_bytes: bytes,
        detection_method: str = "llm",
    ) -> List[QuestionAnswerPdfPair]:
        """Split question/answer papers and pair them by normalized question label."""
        if detection_method != "llm":
            q_parts = await DocumentSplitter.split_pdf_by_questions_with_labels(
                question_pdf_bytes,
                detection_method=detection_method,
            )
            a_parts = await DocumentSplitter.split_pdf_by_questions_with_labels(
                answer_pdf_bytes,
                detection_method=detection_method,
            )
        else:
            q_doc = fitz.open(stream=question_pdf_bytes, filetype="pdf")
            a_doc = fitz.open(stream=answer_pdf_bytes, filetype="pdf")
            try:
                q_page = q_doc[0]
                a_page = a_doc[0]

                q_base = Image.open(io.BytesIO(q_page.get_pixmap(dpi=120).tobytes("png"))).convert("RGB")
                a_base = Image.open(io.BytesIO(a_page.get_pixmap(dpi=120).tobytes("png"))).convert("RGB")

                q_candidates = {
                    "r0": q_base,
                    "r90": q_base.rotate(90, expand=True),
                    "r180": q_base.rotate(180, expand=True),
                    "r270": q_base.rotate(270, expand=True),
                }
                a_candidates = {
                    "r0": a_base,
                    "r90": a_base.rotate(90, expand=True),
                    "r180": a_base.rotate(180, expand=True),
                    "r270": a_base.rotate(270, expand=True),
                }

                q_parts = []
                a_parts = []
                for attempt in range(2):
                    detected = await QuestionDetector.detect_question_answer_layout_with_llm(
                        q_candidates,
                        a_candidates,
                    )
                    if not detected:
                        continue

                    q_best = str(detected.get("question_best_orientation", "r0")).lower()
                    a_best = str(detected.get("answer_best_orientation", "r0")).lower()
                    q_regions = list(detected.get("question_regions", []))
                    a_regions = list(detected.get("answer_regions", []))

                    q_selected = q_candidates.get(q_best, q_base)
                    a_selected = a_candidates.get(a_best, a_base)

                    q_parts = QuestionSplitter.split_image_by_questions_with_labels(q_selected, q_regions)
                    a_parts = QuestionSplitter.split_image_by_questions_with_labels(a_selected, a_regions)

                    part_heights = [
                        QuestionSplitter.pdf_first_page_height(pdf_data)
                        for _label, pdf_data in [*q_parts, *a_parts]
                    ]
                    all_parts_are_tiny = bool(part_heights) and all(height <= 190.0 for height in part_heights)
                    if not all_parts_are_tiny or attempt == 1:
                        break

                    print("[DocumentSplitter] Detected only tiny crops; retrying layout detection.")
            finally:
                q_doc.close()
                a_doc.close()

        q_map: Dict[str, List[bytes]] = {}
        a_map: Dict[str, List[bytes]] = {}
        for label, pdf_data in q_parts:
            key = QuestionDetector.normalize_question_label(label)
            q_map.setdefault(key, []).append(pdf_data)
        for label, pdf_data in a_parts:
            key = QuestionDetector.normalize_question_label(label)
            a_map.setdefault(key, []).append(pdf_data)

        pairs: List[QuestionAnswerPdfPair] = []
        for key in sorted(set(q_map.keys()) & set(a_map.keys())):
            count = min(len(q_map[key]), len(a_map[key]))
            for index in range(count):
                pairs.append(
                    QuestionAnswerPdfPair(
                        question_label=key,
                        question_pdf=q_map[key][index],
                        answer_pdf=a_map[key][index],
                        metadata={"match_index": index},
                    )
                )

        return pairs
