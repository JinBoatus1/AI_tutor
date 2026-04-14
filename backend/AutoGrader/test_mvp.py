import asyncio
import unittest

from AutoGrader.inmemory import InMemoryAutoGrader
from AutoGrader.models import (
    AutoGradeJobSubmitRequest,
    AutoGradeStatusCode,
    BundleKind,
    DocumentBundle,
    GradeTaskItem,
    SourceItem,
    SourceType,
)


class TestAutoGraderMVP(unittest.IsolatedAsyncioTestCase):
    async def test_minimal_job_flow(self) -> None:
        grader = InMemoryAutoGrader()

        request = AutoGradeJobSubmitRequest(
            prompt="grade by correctness",
            items=[
                GradeTaskItem(
                    paper_id="paper-001",
                    student_bundle=DocumentBundle(
                        bundle_id="student-001",
                        kind=BundleKind.STUDENT_PAPER,
                        sources=[
                            SourceItem(
                                source_type=SourceType.PDF,
                                uri="/tmp/student.pdf",
                                mime_type="application/pdf",
                            )
                        ],
                    ),
                    answer_bundle=DocumentBundle(
                        bundle_id="answer-001",
                        kind=BundleKind.ANSWER_KEY,
                        sources=[
                            SourceItem(
                                source_type=SourceType.PDF,
                                uri="/tmp/answer.pdf",
                                mime_type="application/pdf",
                            )
                        ],
                    ),
                )
            ],
        )

        submit_resp = await grader.submit_job(request)
        self.assertEqual(submit_resp.status_code, AutoGradeStatusCode.ACCEPTED)
        self.assertEqual(submit_resp.accepted_count, 1)

        # Poll with a short timeout window for async completion.
        status = None
        for _ in range(50):
            status = await grader.get_job_status(submit_resp.job_id)
            if status.status_code == AutoGradeStatusCode.DONE:
                break
            await asyncio.sleep(0.01)

        self.assertIsNotNone(status)
        self.assertEqual(status.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(status.total, 1)
        self.assertEqual(status.completed, 1)

        results_resp = await grader.get_job_results(submit_resp.job_id)
        self.assertEqual(results_resp.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(len(results_resp.results), 1)

        paper_result = results_resp.results[0]
        self.assertEqual(paper_result.paper_id, "paper-001")
        self.assertEqual(paper_result.result.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(paper_result.result.score, 100.0)


if __name__ == "__main__":
    unittest.main()
