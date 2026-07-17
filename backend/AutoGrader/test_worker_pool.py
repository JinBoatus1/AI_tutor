from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.models import (
    ConsensusQuestionScore,
    PaperManifest,
    PaperManifestQuestion,
    QuestionAttempt,
    QuestionBatchTask,
    QuestionRubric,
)
from AutoGrader.question_pool import InMemoryQuestionPool
from AutoGrader.worker_pool import (
    ConcurrentQuestionWorkerPool,
    InMemoryQuestionResultStore,
    MultiPaperGradingCoordinator,
)


def _attempt(
    paper_id: str,
    label: str,
    *,
    score: float,
    max_score: float,
    template_id: str = "exam-1",
) -> QuestionAttempt:
    canonical_id = f"{template_id}:{label}"
    return QuestionAttempt(
        paper_instance_id=paper_id,
        question_attempt_id=f"{paper_id}:{label}",
        exam_template_id=template_id,
        canonical_question_id=canonical_id,
        displayed_label=label,
        question_pdf=f"question-{canonical_id}".encode(),
        answer_pdf=f"answer-{paper_id}-{label}".encode(),
        question_text=f"Question {label}",
        answer_text=f"Answer from {paper_id}",
        metadata={
            "rubric_version": "initial",
            "expected_score": score,
            "expected_max_score": max_score,
        },
    )


def _manifest(paper_id: str, attempts: list[QuestionAttempt]) -> PaperManifest:
    return PaperManifest(
        paper_instance_id=paper_id,
        exam_template_id=attempts[0].exam_template_id,
        questions=[
            PaperManifestQuestion(
                question_attempt_id=attempt.question_attempt_id,
                canonical_question_id=attempt.canonical_question_id,
                displayed_label=attempt.displayed_label,
                max_score=float(attempt.metadata["expected_max_score"]),
            )
            for attempt in attempts
        ],
    )


class _FakeBatchScorer:
    def __init__(
        self,
        *,
        delay: float = 0.0,
        fail_first: int = 0,
        always_fail: bool = False,
    ) -> None:
        self.delay = delay
        self.fail_first = fail_first
        self.always_fail = always_fail
        self.call_count = 0
        self.active = 0
        self.peak = 0
        self.active_canonical_ids: set[str] = set()
        self.same_question_overlap = False
        self.tasks: list[QuestionBatchTask] = []

    async def score_batch(self, task: QuestionBatchTask) -> list[ConsensusQuestionScore]:
        self.call_count += 1
        self.tasks.append(task.model_copy(deep=True))
        self.active += 1
        self.peak = max(self.peak, self.active)
        if task.canonical_question_id in self.active_canonical_ids:
            self.same_question_overlap = True
        self.active_canonical_ids.add(task.canonical_question_id)
        try:
            if self.delay:
                await asyncio.sleep(self.delay)
            if self.always_fail or self.call_count <= self.fail_first:
                raise RuntimeError("synthetic batch failure")
            return [
                ConsensusQuestionScore(
                    paper_instance_id=attempt.paper_instance_id,
                    question_attempt_id=attempt.question_attempt_id,
                    canonical_question_id=attempt.canonical_question_id,
                    displayed_label=attempt.displayed_label,
                    score=float(attempt.metadata["expected_score"]),
                    max_score=float(attempt.metadata["expected_max_score"]),
                    mode="absolute",
                    confidence=90,
                    consensus="high",
                    agent_count=3,
                    rubric_version=task.rubric_version,
                )
                for attempt in task.attempts
            ]
        finally:
            self.active_canonical_ids.discard(task.canonical_question_id)
            self.active -= 1


class WorkerPoolTests(unittest.IsolatedAsyncioTestCase):
    async def test_workers_run_different_questions_concurrently_and_batch_same_question(self) -> None:
        attempts = [
            _attempt("paper-a", "5", score=8, max_score=10),
            _attempt("paper-b", "5", score=6, max_score=10),
            _attempt("paper-a", "6", score=15, max_score=20),
            _attempt("paper-b", "6", score=18, max_score=20),
        ]
        scorer = _FakeBatchScorer(delay=0.03)
        worker_pool = ConcurrentQuestionWorkerPool(
            InMemoryQuestionPool(),
            scorer,
            worker_count=2,
            max_batch_size=10,
            max_batch_retries=0,
        )

        results, report = await worker_pool.score_attempts(attempts)

        self.assertEqual(scorer.peak, 2)
        self.assertEqual(report.batches_completed, 2)
        self.assertEqual(report.attempts_completed, 4)
        self.assertEqual(len(results), 4)
        batches = {
            task.canonical_question_id: {attempt.paper_instance_id for attempt in task.attempts}
            for task in scorer.tasks
        }
        self.assertEqual(batches["exam-1:5"], {"paper-a", "paper-b"})
        self.assertEqual(batches["exam-1:6"], {"paper-a", "paper-b"})

    async def test_multi_paper_coordinator_returns_totals_for_the_correct_paper(self) -> None:
        paper_a = [
            _attempt("paper-a", "5", score=8, max_score=10),
            _attempt("paper-a", "6", score=15, max_score=20),
        ]
        paper_b = [
            _attempt("paper-b", "5", score=6, max_score=10),
            _attempt("paper-b", "6", score=18, max_score=20),
        ]
        scorer = _FakeBatchScorer(delay=0.01)
        worker_pool = ConcurrentQuestionWorkerPool(
            InMemoryQuestionPool(),
            scorer,
            worker_count=2,
            max_batch_size=10,
        )
        coordinator = MultiPaperGradingCoordinator(worker_pool)
        await coordinator.register_paper(_manifest("paper-a", paper_a), paper_a)
        await coordinator.register_paper(_manifest("paper-b", paper_b), paper_b)

        report = await coordinator.run_until_idle()
        summary_a = await coordinator.get_paper_summary("paper-a")
        summary_b = await coordinator.get_paper_summary("paper-b")

        self.assertEqual(report.attempts_completed, 4)
        self.assertIsNotNone(summary_a)
        self.assertIsNotNone(summary_b)
        assert summary_a is not None and summary_b is not None
        self.assertEqual(summary_a.total_score, 23)
        self.assertEqual(summary_b.total_score, 24)
        self.assertEqual(
            {score.paper_instance_id for score in summary_a.scores},
            {"paper-a"},
        )
        self.assertEqual(
            {score.paper_instance_id for score in summary_b.scores},
            {"paper-b"},
        )

    async def test_one_canonical_question_never_runs_in_two_workers_at_once(self) -> None:
        attempts = [
            _attempt(f"paper-{index}", "5", score=8, max_score=10)
            for index in range(5)
        ] + [
            _attempt("paper-x", "6", score=15, max_score=20),
            _attempt("paper-y", "6", score=18, max_score=20),
        ]
        scorer = _FakeBatchScorer(delay=0.02)
        worker_pool = ConcurrentQuestionWorkerPool(
            InMemoryQuestionPool(),
            scorer,
            worker_count=3,
            max_batch_size=2,
        )

        results, report = await worker_pool.score_attempts(attempts)

        self.assertEqual(len(results), 7)
        self.assertEqual(report.batches_completed, 4)
        self.assertFalse(scorer.same_question_overlap)
        q5_tasks = [task for task in scorer.tasks if task.canonical_question_id == "exam-1:5"]
        self.assertEqual([len(task.attempts) for task in q5_tasks], [2, 2, 1])

    async def test_transient_batch_failure_is_retried_once(self) -> None:
        attempt = _attempt("paper-a", "5", score=8, max_score=10)
        scorer = _FakeBatchScorer(fail_first=1)
        worker_pool = ConcurrentQuestionWorkerPool(
            InMemoryQuestionPool(),
            scorer,
            worker_count=1,
            max_batch_retries=1,
        )

        results, report = await worker_pool.score_attempts([attempt])

        self.assertEqual(scorer.call_count, 2)
        self.assertEqual(report.retried_batches, 1)
        self.assertEqual(report.failed_batches, 0)
        self.assertEqual(results[0].score, 8)

    async def test_permanent_batch_failure_becomes_manual_review(self) -> None:
        attempt = _attempt("paper-a", "5", score=8, max_score=10)
        scorer = _FakeBatchScorer(always_fail=True)
        pool = InMemoryQuestionPool()
        worker_pool = ConcurrentQuestionWorkerPool(
            pool,
            scorer,
            worker_count=1,
            max_batch_retries=1,
        )

        results, report = await worker_pool.score_attempts([attempt])
        snapshot = await pool.snapshot()

        self.assertEqual(scorer.call_count, 2)
        self.assertEqual(report.failed_batches, 1)
        self.assertEqual(report.manual_review_count, 1)
        self.assertTrue(results[0].manual_review)
        self.assertEqual(snapshot[0].status.value, "manual_review")

    async def test_cancelling_workers_releases_active_question_lease(self) -> None:
        attempt = _attempt("paper-a", "5", score=8, max_score=10)
        scorer = _FakeBatchScorer(delay=1.0)
        pool = InMemoryQuestionPool()
        worker_pool = ConcurrentQuestionWorkerPool(
            pool,
            scorer,
            worker_count=1,
        )
        run_task = asyncio.create_task(worker_pool.score_attempts([attempt]))
        while scorer.active == 0:
            await asyncio.sleep(0)

        run_task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await run_task
        snapshot = await pool.snapshot()

        self.assertEqual(snapshot[0].status.value, "pending")

    async def test_registered_rubric_is_attached_to_worker_batch(self) -> None:
        attempt = _attempt("paper-a", "5", score=8, max_score=10)
        rubric = QuestionRubric(
            canonical_question_id=attempt.canonical_question_id,
            version="initial",
            reference_answer="The reference answer",
            max_score=10,
        )
        scorer = _FakeBatchScorer()
        worker_pool = ConcurrentQuestionWorkerPool(
            InMemoryQuestionPool(),
            scorer,
            worker_count=1,
        )

        await worker_pool.score_attempts([attempt], rubrics=[rubric])

        self.assertEqual(len(scorer.tasks), 1)
        self.assertEqual(scorer.tasks[0].rubric, rubric)

    async def test_new_rubric_version_requeues_attempt_and_becomes_latest_result(self) -> None:
        original = _attempt("paper-a", "5", score=8, max_score=10)
        revised = original.model_copy(
            deep=True,
            update={
                "metadata": {
                    **original.metadata,
                    "rubric_version": "v2",
                    "expected_score": 9,
                }
            },
        )
        scorer = _FakeBatchScorer()
        worker_pool = ConcurrentQuestionWorkerPool(
            InMemoryQuestionPool(),
            scorer,
            worker_count=1,
        )
        await worker_pool.score_attempts([original])

        revised_results, _report = await worker_pool.score_attempts(
            [revised],
            rubrics=[
                QuestionRubric(
                    canonical_question_id=revised.canonical_question_id,
                    version="v2",
                    reference_answer="Revised reference answer",
                    max_score=10,
                )
            ],
        )
        stored_versions = await worker_pool.result_store.snapshot()

        self.assertEqual(revised_results[0].score, 9)
        self.assertEqual(revised_results[0].rubric_version, "v2")
        self.assertEqual(len(stored_versions), 2)


class ResultStoreTests(unittest.IsolatedAsyncioTestCase):
    async def test_first_result_is_idempotently_preserved(self) -> None:
        attempt = _attempt("paper-a", "5", score=8, max_score=10)
        task = QuestionBatchTask(
            task_id="task-1",
            exam_template_id=attempt.exam_template_id,
            canonical_question_id=attempt.canonical_question_id,
            attempts=[attempt],
        )
        first = ConsensusQuestionScore(
            paper_instance_id="paper-a",
            question_attempt_id=attempt.question_attempt_id,
            canonical_question_id=attempt.canonical_question_id,
            displayed_label="5",
            score=8,
            max_score=10,
            mode="absolute",
        )
        later_retry = first.model_copy(update={"score": 5})
        store = InMemoryQuestionResultStore()

        await store.save_batch(task, [first])
        persisted = await store.save_batch(task, [later_retry])

        self.assertEqual(persisted[0].score, 8)

    async def test_result_store_rejects_cross_paper_result(self) -> None:
        attempt = _attempt("paper-a", "5", score=8, max_score=10)
        task = QuestionBatchTask(
            task_id="task-1",
            exam_template_id=attempt.exam_template_id,
            canonical_question_id=attempt.canonical_question_id,
            attempts=[attempt],
        )
        foreign = ConsensusQuestionScore(
            paper_instance_id="paper-b",
            question_attempt_id=attempt.question_attempt_id,
            canonical_question_id=attempt.canonical_question_id,
            displayed_label="5",
            score=8,
            max_score=10,
            mode="absolute",
        )

        with self.assertRaisesRegex(ValueError, "belongs to paper"):
            await InMemoryQuestionResultStore().save_batch(task, [foreign])


if __name__ == "__main__":
    unittest.main(verbosity=2)
