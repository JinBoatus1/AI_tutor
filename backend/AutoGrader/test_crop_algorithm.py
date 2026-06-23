from __future__ import annotations

import sys
import os
from pathlib import Path

import fitz
from PIL import Image
from PIL import ImageDraw


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.question_splitter import QuestionSplitter


SAVE_PREVIEWS = os.getenv("AUTOGRADER_SAVE_CROP_DEBUG") == "1"


def pdf_size(pdf_bytes: bytes) -> tuple[float, float]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[0]
        return round(page.rect.width, 1), round(page.rect.height, 1)
    finally:
        doc.close()


def save_pdf_preview(pdf_bytes: bytes, output_path: Path) -> None:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        pix = doc[0].get_pixmap(dpi=100)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        pix.save(str(output_path))
    finally:
        doc.close()


def summarize_image(name: str, image: Image.Image, questions: list[dict[str, float | str]]) -> None:
    print(f"{name} image={image.size}")
    for trim in (False, True):
        parts = QuestionSplitter.split_image_by_questions(
            image,
            questions,
            visual_trim_enabled=trim,
        )
        mode = "trim" if trim else "base"
        print(mode, [pdf_size(part) for part in parts])
        if SAVE_PREVIEWS:
            for index, part in enumerate(parts, start=1):
                safe_name = name.replace(" ", "_").replace("-", "_").lower()
                save_pdf_preview(part, CURRENT_DIR / "test_pdfs" / "crop_debug" / f"{safe_name}_{mode}_{index}.png")


def summarize(name: str, image_path: Path, questions: list[dict[str, float | str]]) -> None:
    summarize_image(name, Image.open(image_path).convert("RGB"), questions)


def main() -> None:
    test_dir = CURRENT_DIR / "test_pdfs"
    synthetic = Image.new("RGB", (900, 1200), "white")
    draw = ImageDraw.Draw(synthetic)
    draw.text((80, 80), "Q1. Short question", fill="black")
    draw.text((80, 135), "Answer: x = 42", fill="black")
    draw.text((80, 760), "Q2. Another short question", fill="black")
    draw.text((80, 815), "Answer: y = 7", fill="black")
    summarize_image(
        "synthetic loose-bottom",
        synthetic,
        [
            {"label": "1", "top_percent": 0.0, "bottom_percent": 60.0},
            {"label": "2", "top_percent": 60.0, "bottom_percent": 98.5},
        ],
    )
    summarize(
        "Q5Q6 tight",
        test_dir / "Q5Q6.jpg",
        [
            {"label": "5", "top_percent": 0.0, "bottom_percent": 52.0},
            {"label": "6", "top_percent": 52.0, "bottom_percent": 98.5},
        ],
    )
    summarize(
        "Q5Q6 loose-bottom",
        test_dir / "Q5Q6.jpg",
        [
            {"label": "5", "top_percent": 0.0, "bottom_percent": 75.0},
            {"label": "6", "top_percent": 52.0, "bottom_percent": 98.5},
        ],
    )
    summarize(
        "T1 tight",
        test_dir / "T1.jpg",
        [
            {"label": "a", "top_percent": 0.0, "bottom_percent": 22.0},
            {"label": "b", "top_percent": 22.0, "bottom_percent": 45.0},
            {"label": "c", "top_percent": 45.0, "bottom_percent": 70.0},
            {"label": "d", "top_percent": 70.0, "bottom_percent": 98.5},
        ],
    )
    summarize(
        "T1 loose-bottom",
        test_dir / "T1.jpg",
        [
            {"label": "a", "top_percent": 0.0, "bottom_percent": 35.0},
            {"label": "b", "top_percent": 22.0, "bottom_percent": 60.0},
            {"label": "c", "top_percent": 45.0, "bottom_percent": 88.0},
            {"label": "d", "top_percent": 70.0, "bottom_percent": 98.5},
        ],
    )


if __name__ == "__main__":
    main()
