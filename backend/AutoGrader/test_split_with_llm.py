"""
Test real pairing flow: split question paper and answer paper, then build PDF pairs.
"""

from pathlib import Path
import asyncio
import re
import sys

from PIL import Image

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.question_splitter import DocumentSplitter, QuestionSplitter

test_dir = Path("h:/work_space/AI_tutor/backend/AutoGrader/test_pdfs")


def load_image(image_path: Path) -> Image.Image:
    image = Image.open(image_path)
    return image.convert("RGB") if image.mode != "RGB" else image


def normalize_label(label: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "", str(label)).strip().lower()
    return cleaned or "q"


async def main() -> None:
    print("=" * 70)
    print("Testing Q/Answer PDF Pairing with Single LLM Call for Both Documents")
    print("=" * 70)

    question_img_path = test_dir / "Q5Q6.jpg"
    answer_img_path = test_dir / "Answer.jpg"
    if not question_img_path.exists() or not answer_img_path.exists():
        print(f"ERROR: missing inputs: {question_img_path} or {answer_img_path}")
        return

    print(f"\n[1] Loading question image: {question_img_path.name}")
    question_img = load_image(question_img_path)
    question_pdf_bytes = QuestionSplitter.image_to_pdf_bytes(question_img)
    print(f"    question pdf size: {len(question_pdf_bytes):,} bytes")

    print(f"\n[2] Loading answer image: {answer_img_path.name}")
    answer_img = load_image(answer_img_path)
    answer_pdf_bytes = QuestionSplitter.image_to_pdf_bytes(answer_img)
    print(f"    answer pdf size: {len(answer_pdf_bytes):,} bytes")

    print("\n[3] Building question-answer pairs...")
    pairs = await DocumentSplitter.build_question_answer_pairs(
        question_pdf_bytes,
        answer_pdf_bytes,
        detection_method="llm",
    )
    print(f"    paired count: {len(pairs)}")
    if not pairs:
        print("    [FAILED] no matched question-answer pairs")
        return

    print("\n[4] Saving paired pdf files...")
    output_dir = test_dir / "split_output_pairs"
    output_dir.mkdir(exist_ok=True)

    for index, pair in enumerate(pairs, start=1):
        q_label = normalize_label(pair.question_label)
        question_out = output_dir / f"pair_{index:02d}_q_{q_label}.pdf"
        answer_out = output_dir / f"pair_{index:02d}_a_{q_label}.pdf"
        with open(question_out, "wb") as f:
            f.write(pair.question_pdf)
        with open(answer_out, "wb") as f:
            f.write(pair.answer_pdf)
        print(
            f"      pair#{index} label={pair.question_label} -> "
            f"{question_out.name}, {answer_out.name}"
        )

    print(f"\n[SUCCESS] Output saved to: {output_dir}")
    print("\nYou can now manually verify each pair_*_q_*.pdf and pair_*_a_*.pdf")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
