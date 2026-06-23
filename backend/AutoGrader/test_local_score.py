from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.grader import AutoGraderEntry


async def main() -> None:
    test_dir = CURRENT_DIR / "test_pdfs"
    question_path = test_dir / "Q5Q6.jpg"
    answer_path = test_dir / "Answer.jpg"

    if not question_path.exists():
        raise FileNotFoundError(f"Missing question input: {question_path}")
    if not answer_path.exists():
        raise FileNotFoundError(f"Missing answer input: {answer_path}")

    entry = AutoGraderEntry()
    result = await entry.pair_and_score_paper(
        paper_id="q5q6-local-test",
        question_source=question_path,
        answer_source=answer_path,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())