"""Recognition helpers for cropped question and answer pairs."""

from __future__ import annotations

import json
import os
from typing import Any

from deps import create_chat_completion
from .models import QuestionAnswerPdfPair
from .prompt_loader import get_prompt, render_prompt
from .question_splitter import QuestionDetector
from .vision import pdf_first_page_data_url


class QuestionAnswerRecognizer:
    """Use one vision call to transcribe paired crops and decide whether they are gradeable."""

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

        system_msg = get_prompt("recognizer.system")
        user_parts: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": get_prompt("recognizer.user"),
            }
        ]

        for pair in pairs:
            label = QuestionDetector.normalize_question_label(pair.question_label)
            user_parts.append(
                {
                    "type": "text",
                    "text": render_prompt("recognizer.question_label", label=label),
                }
            )
            user_parts.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": pdf_first_page_data_url(
                            pair.question_pdf,
                            dpi_env="AUTOGRADER_RECOGNIZER_IMAGE_DPI",
                            default_dpi=120,
                        )
                    },
                }
            )
            user_parts.append(
                {
                    "type": "text",
                    "text": render_prompt("recognizer.answer_label", label=label),
                }
            )
            user_parts.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": pdf_first_page_data_url(
                            pair.answer_pdf,
                            dpi_env="AUTOGRADER_RECOGNIZER_IMAGE_DPI",
                            default_dpi=120,
                        )
                    },
                }
            )

        resp = create_chat_completion(
            model=os.getenv("AUTOGRADER_MODEL", "gpt-5.2"),
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_parts},
            ],
            temperature=0.0,
        )
        raw_text = resp.choices[0].message.content or ""
        return self._parse_inspection_map(raw_text)
