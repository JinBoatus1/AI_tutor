"""
Test T1.jpg splitting using the single-call LLM pipeline.
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

from AutoGrader.question_splitter import QuestionDetector, QuestionSplitter

test_dir = Path("h:/work_space/AI_tutor/backend/AutoGrader/test_pdfs")


def load_image(image_path: Path) -> Image.Image:
    image = Image.open(image_path)
    return image.convert("RGB") if image.mode != "RGB" else image


def normalize_label(label: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "", str(label)).strip().lower()
    return cleaned or "q"


async def main() -> None:
    print("=" * 70)
    print("Testing T1.jpg Question Splitting with Single LLM Call")
    print("=" * 70)

    jpg_path = test_dir / "T1.jpg"
    if not jpg_path.exists():
        print(f"ERROR: {jpg_path} not found")
        return

    print(f"\n[1] Loading {jpg_path.name}...")
    raw_img = load_image(jpg_path)
    candidates = {
        "r0": raw_img,
        "r90": raw_img.rotate(90, expand=True),
        "r180": raw_img.rotate(180, expand=True),
        "r270": raw_img.rotate(270, expand=True),
    }
    print(f"    Candidate sizes: r0={candidates['r0'].size}, r90={candidates['r90'].size}, r180={candidates['r180'].size}, r270={candidates['r270'].size}")

    print("\n[2] Analyzing orientation + questions in one LLM call...")
    analysis = await QuestionDetector.detect_layout_and_questions_with_llm(candidates)
    if not analysis:
        print("    [FAILED] No analysis result returned by LLM")
        return

    best_orientation = str(analysis.get("best_orientation", "r0")).lower()
    selected_img = candidates.get(best_orientation, raw_img)
    print(f"    Orientation chosen: {best_orientation}")

    questions = analysis.get("questions", [])
    print(f"\n[3] Parsing results...")
    print(f"    Found {len(questions)} questions:")
    for q in questions:
        label = q.get("label", "?")
        top = q.get("top_percent")
        bottom = q.get("bottom_percent")
        if top is not None and bottom is not None:
            print(f"      Question {label}: top={float(top):.1f}%, bottom={float(bottom):.1f}%")
        else:
            print(f"      Question {label}: missing bounds")

    print(f"\n[4] Splitting image into PDFs...")
    if not questions:
        print("    [FAILED] No questions detected by LLM")
        return

    pdfs = QuestionSplitter.split_image_by_questions(selected_img, questions)
    print(f"    Generated {len(pdfs)} question PDFs")

    output_dir = test_dir / "split_output"
    output_dir.mkdir(exist_ok=True)

    for index, q_pdf in enumerate(pdfs):
        raw_label = questions[index].get("label", str(index + 1))
        q_label = normalize_label(raw_label)
        out_file = output_dir / f"question_{q_label}.pdf"
        with open(out_file, "wb") as f:
            f.write(q_pdf)
        print(f"      Saved: {out_file.name} ({len(q_pdf):,} bytes) from label '{raw_label}'")

    print(f"\n[SUCCESS] Output saved to: {output_dir}")
    print(f"\nYou can now manually check the split PDFs to verify:")
    for q in questions:
        q_label = normalize_label(q.get("label", "q"))
        print(f"  - Question {q_label}: {output_dir}/question_{q_label}.pdf")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
