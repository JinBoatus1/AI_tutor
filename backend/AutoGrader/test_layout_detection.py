from __future__ import annotations

import asyncio
import io
import json
import sys
from pathlib import Path

import fitz
from PIL import Image


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.grader import AutoGraderEntry
from AutoGrader.question_splitter import QuestionDetector


async def main() -> None:
    test_dir = CURRENT_DIR / "test_pdfs"
    question_pdf = AutoGraderEntry._load_document_bytes(test_dir / "Q5Q6.jpg")
    answer_pdf = AutoGraderEntry._load_document_bytes(test_dir / "Answer.jpg")

    q_doc = fitz.open(stream=question_pdf, filetype="pdf")
    a_doc = fitz.open(stream=answer_pdf, filetype="pdf")
    try:
        q_base = Image.open(io.BytesIO(q_doc[0].get_pixmap(dpi=120).tobytes("png"))).convert("RGB")
        a_base = Image.open(io.BytesIO(a_doc[0].get_pixmap(dpi=120).tobytes("png"))).convert("RGB")
    finally:
        q_doc.close()
        a_doc.close()

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

    detected = await QuestionDetector.detect_question_answer_layout_with_llm(q_candidates, a_candidates)
    print(json.dumps(detected, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
