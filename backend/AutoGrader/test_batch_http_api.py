from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import api_routes
from AutoGrader.public_api import AutoGraderBatchGradeResponse


class BatchHttpApiTests(unittest.TestCase):
    def test_batch_route_preserves_file_order_and_paper_identity(self) -> None:
        app = FastAPI()
        app.include_router(api_routes.router)
        temporary_inputs: list[str] = []

        async def fake_grade(request):
            temporary_inputs.append(request.question_source)
            temporary_inputs.extend(paper.answer_source for paper in request.papers)
            self.assertTrue(all(os.path.isfile(path) for path in temporary_inputs))
            self.assertEqual(
                [paper.display_name for paper in request.papers],
                ["Class A/Student.pdf", "Class B/Student.pdf"],
            )
            return AutoGraderBatchGradeResponse.model_validate(
                {
                    "paper_count": 2,
                    "papers": [
                        {
                            "paper_id": request.papers[0].paper_id,
                            "display_name": request.papers[0].display_name,
                            "pair_count": 1,
                            "grading_mode": "question_answer",
                            "pairs": ["5"],
                            "scores": {
                                "5": {
                                    "score": 8,
                                    "mode": "absolute",
                                    "max_score": 10,
                                    "paper_instance_id": request.papers[0].paper_id,
                                    "question_attempt_id": f"{request.papers[0].paper_id}:1:5",
                                    "feedback": {"summary": "Student A feedback"},
                                }
                            },
                            "all_absolute": True,
                            "total_score": 8,
                            "total_max_score": 10,
                        },
                        {
                            "paper_id": request.papers[1].paper_id,
                            "display_name": request.papers[1].display_name,
                            "pair_count": 1,
                            "grading_mode": "question_answer",
                            "pairs": ["5"],
                            "scores": {
                                "5": {
                                    "score": 6,
                                    "mode": "absolute",
                                    "max_score": 10,
                                    "paper_instance_id": request.papers[1].paper_id,
                                    "question_attempt_id": f"{request.papers[1].paper_id}:1:5",
                                    "feedback": {"summary": "Student B feedback"},
                                }
                            },
                            "all_absolute": True,
                            "total_score": 6,
                            "total_max_score": 10,
                        },
                    ],
                }
            )

        with patch.object(
            api_routes,
            "grade_papers_once",
            new=AsyncMock(side_effect=fake_grade),
        ):
            with TestClient(app) as client:
                response = client.post(
                    "/api/autograder/grade-batch",
                    data={
                        "batch_id": "class demo",
                        "answer_display_names": [
                            "Class A/Student.pdf",
                            "../Class B\\Student.pdf",
                        ],
                    },
                    files=[
                        ("question_file", ("Questions.jpg", b"question", "image/jpeg")),
                        ("answer_files", ("Student.pdf", b"answer-a", "application/pdf")),
                        ("answer_files", ("Student.pdf", b"answer-b", "application/pdf")),
                    ],
                )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["paper_count"], 2)
        self.assertEqual(
            [paper["display_name"] for paper in payload["papers"]],
            ["Class A/Student.pdf", "Class B/Student.pdf"],
        )
        self.assertEqual(
            [
                payload["papers"][0]["scores"]["5"]["feedback"]["summary"],
                payload["papers"][1]["scores"]["5"]["feedback"]["summary"],
            ],
            ["Student A feedback", "Student B feedback"],
        )
        self.assertTrue(all(not os.path.exists(path) for path in temporary_inputs))


if __name__ == "__main__":
    unittest.main()
