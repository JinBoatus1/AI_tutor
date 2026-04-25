"""Recognition helpers for cropped question and answer pairs."""

from __future__ import annotations

import base64
import json
from typing import Any

import fitz

from deps import create_chat_completion
from .models import QuestionAnswerPdfPair
from .question_splitter import QuestionDetector


class QuestionAnswerRecognizer:
    """Use one vision call to transcribe paired crops and decide whether they are gradeable."""

    @staticmethod
    def _pdf_first_page_to_b64(pdf_bytes: bytes, dpi: int = 150) -> str:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            page = doc[0]
            pix = page.get_pixmap(dpi=dpi)
            return base64.b64encode(pix.tobytes("png")).decode("utf-8")
        finally:
            doc.close()

    @staticmethod
    def _parse_inspection_map(raw_text: str) -> dict[str, dict[str, Any]]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```", 1)[1].strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()

        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "items" in parsed and isinstance(parsed["items"], list):
            items = parsed["items"]
        elif isinstance(parsed, list):
            items = parsed
        else:
            raise ValueError("Recognition output must be a JSON array or an object with an items list")

        inspections: dict[str, dict[str, Any]] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            label = QuestionDetector.normalize_question_label(str(item.get("label", "")))
            if not label:
                continue
            inspections[label] = {
                "label": label,
                "can_grade": bool(item.get("can_grade", False)),
                "reason": item.get("reason"),
                "question_text": item.get("question_text"),
                "answer_text": item.get("answer_text"),
            }
        return inspections

    async def inspect_pairs(self, pairs: list[QuestionAnswerPdfPair]) -> dict[str, dict[str, Any]]:
        if not pairs:
            return {}

        system_msg = (
            "You are transcribing cropped exam question-answer pairs. For each pair, extract the question text and answer text as faithfully as possible. "
            "Prefer verbatim transcription over interpretation. Then decide whether the pair is clear enough to grade automatically. "
            "Mark can_grade=false when handwriting is illegible, the OCR is too noisy, the question is incomplete, the answer cannot be reliably interpreted, or the text is too uncertain for scoring. "
            "Return ONLY valid JSON. Use this shape: "
            '{"items":[{"label":"5","question_text":"...","answer_text":"...","can_grade":true,"reason":"..."}]}. '
            "Keep reason short and specific."
        )
        user_parts: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    "For each question-answer pair, transcribe the visible text and judge whether the result is clear enough for automatic grading. "
                    "If the pair is not clear enough, set can_grade=false and explain briefly why. Do not guess missing text."
                ),
            }
        ]

        for pair in pairs:
            label = QuestionDetector.normalize_question_label(pair.question_label)
            user_parts.append({"type": "text", "text": f"PAIR {label} QUESTION"})
            user_parts.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{self._pdf_first_page_to_b64(pair.question_pdf)}"}})
            user_parts.append({"type": "text", "text": f"PAIR {label} ANSWER"})
            user_parts.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{self._pdf_first_page_to_b64(pair.answer_pdf)}"}})

        resp = create_chat_completion(
            model="gpt-5.2",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_parts},
            ],
            temperature=0.0,
        )
        raw_text = resp.choices[0].message.content or ""
        return self._parse_inspection_map(raw_text)