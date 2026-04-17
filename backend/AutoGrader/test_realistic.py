"""Realistic test cases for AutoGrader MVP with multiple papers and edge cases."""

import asyncio
import unittest
from pathlib import Path

from .inmemory import InMemoryAutoGrader
from .models import (
    AutoGradeJobSubmitRequest,
    AutoGradeStatusCode,
    BundleKind,
    DocumentBundle,
    GradeTaskItem,
    SourceItem,
    SourceType,
)


class TestAutoGraderRealistic(unittest.IsolatedAsyncioTestCase):
    """Test MVP autograder with realistic multi-paper scenarios."""

    def setUp(self):
        """Set up fixed test PDF file paths."""
        test_dir = Path(__file__).parent / "test_pdfs"
        self.student_pdf_1 = test_dir / "student_paper_1.pdf"
        self.student_pdf_2 = test_dir / "student_paper_2.pdf"
        self.answer_pdf = test_dir / "answer_key.pdf"
        
        # Ensure PDF files exist
        for pdf in [self.student_pdf_1, self.student_pdf_2, self.answer_pdf]:
            if not pdf.exists():
                raise FileNotFoundError(
                    f"Test PDF not found: {pdf}\n"
                    f"Run 'python AutoGrader/generate_test_pdfs.py' to create test files."
                )

    async def test_multi_paper_job_with_mixed_validity(self):
        """Submit 3 papers: 2 valid, 1 invalid (missing student bundle)."""
        grader = InMemoryAutoGrader()
        
        items = [
            # Valid paper 1: both bundles have sources
            GradeTaskItem(
                paper_id="math-001",
                student_bundle=DocumentBundle(
                    bundle_id="student-001",
                    kind=BundleKind.STUDENT_PAPER,
                    sources=[
                        SourceItem(
                            source_type=SourceType.PDF,
                            uri=str(self.student_pdf_1),
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
                            uri=str(self.answer_pdf),
                            mime_type="application/pdf",
                        )
                    ],
                ),
                metadata={"subject": "math", "grade": 10},
            ),
            # Valid paper 2: both bundles have sources
            GradeTaskItem(
                paper_id="physics-001",
                student_bundle=DocumentBundle(
                    bundle_id="student-002",
                    kind=BundleKind.STUDENT_PAPER,
                    sources=[
                        SourceItem(
                            source_type=SourceType.PDF,
                            uri=str(self.student_pdf_2),
                            mime_type="application/pdf",
                        )
                    ],
                ),
                answer_bundle=DocumentBundle(
                    bundle_id="answer-002",
                    kind=BundleKind.ANSWER_KEY,
                    sources=[
                        SourceItem(
                            source_type=SourceType.PDF,
                            uri=str(self.answer_pdf),
                            mime_type="application/pdf",
                        )
                    ],
                ),
                metadata={"subject": "physics", "grade": 11},
            ),
            # Invalid paper: student bundle missing sources
            GradeTaskItem(
                paper_id="math-002",
                student_bundle=DocumentBundle(
                    bundle_id="student-003",
                    kind=BundleKind.STUDENT_PAPER,
                    sources=[],  # Empty!
                ),
                answer_bundle=DocumentBundle(
                    bundle_id="answer-003",
                    kind=BundleKind.ANSWER_KEY,
                    sources=[
                        SourceItem(
                            source_type=SourceType.PDF,
                            uri=str(self.answer_pdf),
                            mime_type="application/pdf",
                        )
                    ],
                ),
                metadata={"subject": "math", "grade": 10},
            ),
        ]

        request = AutoGradeJobSubmitRequest(
            prompt="Grade by mathematical correctness",
            items=items,
        )

        # Submit job
        submit_resp = await grader.submit_job(request)
        self.assertEqual(submit_resp.status_code, AutoGradeStatusCode.ACCEPTED)
        self.assertEqual(submit_resp.accepted_count, 3)
        job_id = submit_resp.job_id

        # Poll until completion
        for _ in range(100):
            status = await grader.get_job_status(job_id)
            if status.status_code == AutoGradeStatusCode.DONE:
                break
            await asyncio.sleep(0.01)

        status = await grader.get_job_status(job_id)
        self.assertEqual(status.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(status.total, 3)
        self.assertEqual(status.completed, 3)

        # Get results
        results_resp = await grader.get_job_results(job_id)
        self.assertEqual(results_resp.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(len(results_resp.results), 3)

        # Verify individual results
        results_by_paper = {r.paper_id: r for r in results_resp.results}

        # Paper 1 should be DONE with score 100
        paper_1 = results_by_paper["math-001"]
        self.assertEqual(paper_1.paper_id, "math-001")
        self.assertEqual(paper_1.result.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(paper_1.result.score, 100.0)

        # Paper 2 should be DONE with score 100
        paper_2 = results_by_paper["physics-001"]
        self.assertEqual(paper_2.paper_id, "physics-001")
        self.assertEqual(paper_2.result.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(paper_2.result.score, 100.0)

        # Paper 3 should be INVALID_INPUT with NULL score
        paper_3 = results_by_paper["math-002"]
        self.assertEqual(paper_3.paper_id, "math-002")
        self.assertEqual(paper_3.result.status_code, AutoGradeStatusCode.INVALID_INPUT)
        self.assertIsNone(paper_3.result.score)

        print(f"\n[PASS] Job {job_id} completed successfully!")
        print(f"   Results summary: 2 DONE (100pts each), 1 INVALID_INPUT")

    async def test_concurrent_jobs(self) -> None:
        """Submit 2 separate jobs concurrently and verify both complete."""
        grader = InMemoryAutoGrader()

        # Job 1
        job1_request = AutoGradeJobSubmitRequest(
            prompt="Grade job 1",
            items=[
                GradeTaskItem(
                    paper_id="job1-paper1",
                    student_bundle=DocumentBundle(
                        bundle_id="s1",
                        kind=BundleKind.STUDENT_PAPER,
                        sources=[
                            SourceItem(
                                source_type=SourceType.PDF,
                                uri=str(self.student_pdf_1),
                                mime_type="application/pdf",
                            )
                        ],
                    ),
                    answer_bundle=DocumentBundle(
                        bundle_id="a1",
                        kind=BundleKind.ANSWER_KEY,
                        sources=[
                            SourceItem(
                                source_type=SourceType.PDF,
                                uri=str(self.answer_pdf),
                                mime_type="application/pdf",
                            )
                        ],
                    ),
                )
            ],
        )

        # Job 2
        job2_request = AutoGradeJobSubmitRequest(
            prompt="Grade job 2",
            items=[
                GradeTaskItem(
                    paper_id="job2-paper1",
                    student_bundle=DocumentBundle(
                        bundle_id="s2",
                        kind=BundleKind.STUDENT_PAPER,
                        sources=[
                            SourceItem(
                                source_type=SourceType.PDF,
                                uri=str(self.student_pdf_2),
                                mime_type="application/pdf",
                            )
                        ],
                    ),
                    answer_bundle=DocumentBundle(
                        bundle_id="a2",
                        kind=BundleKind.ANSWER_KEY,
                        sources=[
                            SourceItem(
                                source_type=SourceType.PDF,
                                uri=str(self.answer_pdf),
                                mime_type="application/pdf",
                            )
                        ],
                    ),
                )
            ],
        )

        # Submit both concurrently
        resp1 = await grader.submit_job(job1_request)
        resp2 = await grader.submit_job(job2_request)

        job_id_1 = resp1.job_id
        job_id_2 = resp2.job_id

        self.assertNotEqual(job_id_1, job_id_2)

        # Poll both until done
        async def poll_job(job_id: str) -> None:
            for _ in range(100):
                status = await grader.get_job_status(job_id)
                if status.status_code == AutoGradeStatusCode.DONE:
                    return
                await asyncio.sleep(0.01)

        await asyncio.gather(poll_job(job_id_1), poll_job(job_id_2))

        # Both should be DONE
        status1 = await grader.get_job_status(job_id_1)
        status2 = await grader.get_job_status(job_id_2)

        self.assertEqual(status1.status_code, AutoGradeStatusCode.DONE)
        self.assertEqual(status2.status_code, AutoGradeStatusCode.DONE)

        results1 = await grader.get_job_results(job_id_1)
        results2 = await grader.get_job_results(job_id_2)

        self.assertEqual(len(results1.results), 1)
        self.assertEqual(len(results2.results), 1)
        self.assertEqual(results1.results[0].result.score, 100.0)
        self.assertEqual(results2.results[0].result.score, 100.0)

        print(f"\n[PASS] Concurrent jobs completed!")
        print(f"   Job 1: {job_id_1}")
        print(f"   Job 2: {job_id_2}")

    async def test_nonexistent_job(self) -> None:
        """Query status and results for non-existent job ID."""
        grader = InMemoryAutoGrader()
        fake_job_id = "nonexistent-12345"

        status = await grader.get_job_status(fake_job_id)
        self.assertEqual(status.status_code, AutoGradeStatusCode.FILE_NOT_FOUND)
        self.assertEqual(status.total, 0)
        self.assertEqual(status.completed, 0)

        results = await grader.get_job_results(fake_job_id)
        self.assertEqual(results.status_code, AutoGradeStatusCode.FILE_NOT_FOUND)
        self.assertEqual(len(results.results), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
