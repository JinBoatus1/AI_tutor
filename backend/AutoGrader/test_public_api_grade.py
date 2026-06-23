from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.public_api import AutoGraderGradeRequest, grade_paper_once


async def main() -> None:
    test_dir = CURRENT_DIR / "test_pdfs"
    response = await grade_paper_once(
        AutoGraderGradeRequest(
            paper_id="public-api-q5q6",
            question_source=str(test_dir / "Q5Q6.jpg"),
            answer_source=str(test_dir / "Answer.jpg"),
        )
    )
    print(json.dumps(response.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
