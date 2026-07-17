from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import fitz

CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.grader import AutoGraderEntry
from AutoGrader.models import (
    AgentQuestionEvaluation,
    AttemptFeedback,
    ConsensusQuestionScore,
    PaperManifest,
    PaperManifestQuestion,
    PaperQuestionAnswerPairs,
    QuestionBatchTask,
    QuestionAnswerPdfPair,
    QuestionAttempt,
    QuestionAttemptStatus,
)
from AutoGrader.multi_agent import (
    DeterministicQuestionAggregator,
    LLMQuestionEvaluator,
    MultiAgentQuestionScorer,
    PaperScoreAggregator,
    QuestionArbitratorBase,
    QuestionEvaluatorBase,
)
from AutoGrader.question_pool import InMemoryQuestionPool
from AutoGrader.public_api import AutoGraderScoreItem


def _pdf_bytes(text: str) -> bytes:
    doc = fitz.open()
    try:
        page = doc.new_page()
        page.insert_text((72, 72), text)
        return doc.tobytes()
    finally:
        doc.close()


class _FakeEvaluator(QuestionEvaluatorBase):
    def __init__(
        self,
        evaluator_name: str,
        score: float,
        *,
        max_score: float = 10.0,
        mode: str = "absolute",
        delay: float = 0.0,
        fail: bool = False,
        wrong_attempt_id: bool = False,
        tracker: dict[str, int] | None = None,
    ) -> None:
        self.evaluator_name = evaluator_name
        self.score = score
        self.max_score = max_score
        self.mode = mode
        self.delay = delay
        self.fail = fail
        self.wrong_attempt_id = wrong_attempt_id
        self.tracker = tracker

    async def evaluate(self, attempt: QuestionAttempt) -> AgentQuestionEvaluation:
        if self.tracker is not None:
            self.tracker["active"] += 1
            self.tracker["peak"] = max(self.tracker["peak"], self.tracker["active"])
        try:
            if self.delay:
                await asyncio.sleep(self.delay)
            if self.fail:
                raise RuntimeError(f"{self.evaluator_name} failed")
            return AgentQuestionEvaluation(
                question_attempt_id="wrong-attempt" if self.wrong_attempt_id else attempt.question_attempt_id,
                evaluator_name=self.evaluator_name,
                score=self.score,
                max_score=self.max_score if self.mode == "absolute" else None,
                mode=self.mode,
                reason=f"{self.evaluator_name} reason for {attempt.question_attempt_id}",
                feedback=AttemptFeedback(
                    summary=f"{self.evaluator_name} feedback for {attempt.question_attempt_id}",
                    evidence=[attempt.answer_text or "image evidence"],
                ),
            )
        finally:
            if self.tracker is not None:
                self.tracker["active"] -= 1


class _FakeArbitrator(QuestionArbitratorBase):
    def __init__(self, score: float = 7.0) -> None:
        self.score = score
        self.calls: list[str] = []

    async def arbitrate(
        self,
        attempt: QuestionAttempt,
        evaluations: list[AgentQuestionEvaluation],
    ) -> AgentQuestionEvaluation:
        self.calls.append(attempt.question_attempt_id)
        return AgentQuestionEvaluation(
            question_attempt_id=attempt.question_attempt_id,
            evaluator_name="arbitrator",
            score=self.score,
            max_score=10.0,
            mode="absolute",
            reason="Arbitrator selected the evidence-backed score",
            feedback=AttemptFeedback(summary=f"Arbitrated feedback for {attempt.question_attempt_id}"),
        )


class _FakeRecognizer:
    async def inspect_pairs(self, pairs: list[QuestionAnswerPdfPair]) -> dict[str, dict]:
        return {
            pair.question_label: {
                "label": pair.question_label,
                "can_grade": True,
                "reason": None,
                "question_text": f"Question {pair.question_label}",
                "answer_text": f"Student answer {pair.question_label}",
            }
            for pair in pairs
        }


class _DriftingFakeRecognizer:
    def __init__(self) -> None:
        self.call_count = 0

    async def inspect_pairs(self, pairs: list[QuestionAnswerPdfPair]) -> dict[str, dict]:
        self.call_count += 1
        return {
            pair.question_label: {
                "label": pair.question_label,
                "can_grade": pair.question_label != "6",
                "reason": "Needs manual review" if pair.question_label == "6" else None,
                "question_text": f"OCR variant {self.call_count} for question {pair.question_label}",
                "answer_text": f"Student answer {pair.question_label}",
            }
            for pair in pairs
        }


def _attempt(
    attempt_id: str = "paper-a:1:5",
    *,
    paper_id: str = "paper-a",
    template_id: str = "exam-1",
    canonical_id: str = "exam-1:5",
    label: str = "5",
) -> QuestionAttempt:
    return QuestionAttempt(
        paper_instance_id=paper_id,
        question_attempt_id=attempt_id,
        exam_template_id=template_id,
        canonical_question_id=canonical_id,
        displayed_label=label,
        question_pdf=b"question-pdf",
        answer_pdf=b"answer-pdf",
        question_text="What is 2 + 2?",
        answer_text="4",
    )


def _score(
    attempt_id: str,
    *,
    paper_id: str,
    canonical_id: str,
    label: str,
    score: float,
    max_score: float,
) -> ConsensusQuestionScore:
    return ConsensusQuestionScore(
        paper_instance_id=paper_id,
        question_attempt_id=attempt_id,
        canonical_question_id=canonical_id,
        displayed_label=label,
        score=score,
        max_score=max_score,
        mode="absolute",
        confidence=90,
        consensus="high",
        agent_count=3,
    )


class MultiAgentScorerTests(unittest.IsolatedAsyncioTestCase):
    async def test_llm_evaluator_parses_fenced_json_without_external_api(self) -> None:
        attempt = _attempt().model_copy(
            update={
                "question_pdf": _pdf_bytes("What is 2 + 2?"),
                "answer_pdf": _pdf_bytes("4"),
            }
        )

        def fake_completion(**_kwargs):
            content = """```json
{"question_attempt_id":"paper-a:1:5","score":8,"max_score":10,"mode":"absolute",
"manual_review":false,"reason":"Mostly correct","evidence":["visible work"],
"feedback":{"summary":"Specific feedback","awarded_points":null,"deductions":["Minor omission"]}}
```"""
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
            )

        evaluator = LLMQuestionEvaluator(
            "parser-test",
            "Test parsing",
            completion=fake_completion,
        )
        result = await evaluator.evaluate(attempt)

        self.assertEqual(result.question_attempt_id, attempt.question_attempt_id)
        self.assertEqual(result.score, 8)
        self.assertEqual(result.feedback.awarded_points, [])
        self.assertEqual(result.feedback.deductions, ["Minor omission"])

    async def test_evaluators_run_concurrently_and_reach_consensus(self) -> None:
        tracker = {"active": 0, "peak": 0}
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("one", 8.0, delay=0.03, tracker=tracker),
                _FakeEvaluator("two", 8.0, delay=0.03, tracker=tracker),
                _FakeEvaluator("three", 8.5, delay=0.03, tracker=tracker),
            ],
            arbitrator=None,
            max_concurrency=3,
        )

        result = await scorer.score_attempt(_attempt())

        self.assertGreaterEqual(tracker["peak"], 3)
        self.assertEqual(result.score, 8.0)
        self.assertEqual(result.mode, "absolute")
        self.assertEqual(result.agent_count, 3)
        self.assertEqual(result.consensus, "high")
        self.assertFalse(result.arbitrated)
        self.assertIn(result.question_attempt_id, result.feedback.summary)

    async def test_large_disagreement_uses_arbitrator_for_same_attempt(self) -> None:
        arbitrator = _FakeArbitrator(score=7.0)
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("one", 2.0),
                _FakeEvaluator("two", 8.0),
                _FakeEvaluator("three", 10.0),
            ],
            aggregator=DeterministicQuestionAggregator(disagreement_threshold=0.15),
            arbitrator=arbitrator,
        )

        result = await scorer.score_attempt(_attempt())

        self.assertEqual(arbitrator.calls, ["paper-a:1:5"])
        self.assertTrue(result.arbitrated)
        self.assertFalse(result.manual_review)
        self.assertEqual(result.score, 7.0)
        self.assertEqual(result.feedback.summary, "Arbitrated feedback for paper-a:1:5")

    async def test_disagreement_without_arbitrator_requires_manual_review(self) -> None:
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("one", 2.0),
                _FakeEvaluator("two", 8.0),
                _FakeEvaluator("three", 10.0),
            ],
            arbitrator=None,
        )

        result = await scorer.score_attempt(_attempt())

        self.assertTrue(result.manual_review)
        self.assertIsNone(result.score)
        self.assertIn("arbitration is disabled", result.reason or "")

    async def test_failed_or_wrong_id_evaluators_cannot_form_false_consensus(self) -> None:
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("valid", 8.0),
                _FakeEvaluator("failed", 8.0, fail=True),
                _FakeEvaluator("wrong-id", 8.0, wrong_attempt_id=True),
            ],
            arbitrator=None,
        )

        result = await scorer.score_attempt(_attempt())

        self.assertTrue(result.manual_review)
        self.assertIsNone(result.score)
        self.assertEqual(result.agent_count, 1)
        self.assertIn("evaluator_errors", result.metadata)

    async def test_missing_one_evaluator_caps_consensus_below_high(self) -> None:
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("one", 8.0),
                _FakeEvaluator("two", 8.0),
                _FakeEvaluator("failed", 8.0, fail=True),
            ],
            arbitrator=None,
            evaluator_retries=0,
        )

        result = await scorer.score_attempt(_attempt())

        self.assertFalse(result.manual_review)
        self.assertEqual(result.agent_count, 2)
        self.assertLessEqual(result.confidence, 84)
        self.assertEqual(result.consensus, "medium")

    async def test_question_pool_batches_same_question_across_papers(self) -> None:
        pool = InMemoryQuestionPool()
        await pool.add_attempts(
            [
                _attempt("paper-a:1:5", paper_id="paper-a"),
                _attempt("paper-b:1:5", paper_id="paper-b"),
                _attempt(
                    "paper-c:1:5",
                    paper_id="paper-c",
                    template_id="exam-2",
                    canonical_id="exam-2:5",
                ),
            ]
        )

        first = await pool.lease_next_batch(max_batch_size=10)
        self.assertIsNotNone(first)
        assert first is not None
        self.assertEqual(first.exam_template_id, "exam-1")
        self.assertEqual(first.canonical_question_id, "exam-1:5")
        self.assertEqual({item.paper_instance_id for item in first.attempts}, {"paper-a", "paper-b"})
        await pool.complete_batch(first)

        second = await pool.lease_next_batch(max_batch_size=10)
        self.assertIsNotNone(second)
        assert second is not None
        self.assertEqual({item.paper_instance_id for item in second.attempts}, {"paper-c"})

    async def test_question_pool_separates_different_grading_criteria(self) -> None:
        pool = InMemoryQuestionPool()
        first_attempt = _attempt("paper-a:1:5", paper_id="paper-a").model_copy(
            update={"grading_criteria": "Strict proof required"}
        )
        second_attempt = _attempt("paper-b:1:5", paper_id="paper-b").model_copy(
            update={"grading_criteria": "Method marks allowed"}
        )
        await pool.add_attempts([first_attempt, second_attempt])

        batch = await pool.lease_next_batch(max_batch_size=10)

        self.assertIsNotNone(batch)
        assert batch is not None
        self.assertEqual(len(batch.attempts), 1)
        self.assertIn(batch.grading_criteria, {"Strict proof required", "Method marks allowed"})

    async def test_entry_keeps_feedback_owned_by_each_attempt(self) -> None:
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("one", 8.0),
                _FakeEvaluator("two", 8.0),
                _FakeEvaluator("three", 8.0),
            ],
            arbitrator=None,
        )
        pool = InMemoryQuestionPool()
        entry = AutoGraderEntry(question_scorer=scorer, question_pool=pool, recognizer=_FakeRecognizer())
        entry._papers["paper-a"] = PaperQuestionAnswerPairs(
            paper_id="paper-a",
            pairs=[
                QuestionAnswerPdfPair(question_label="5", question_pdf=b"q5", answer_pdf=b"a5"),
                QuestionAnswerPdfPair(question_label="6", question_pdf=b"q6", answer_pdf=b"a6"),
            ],
        )

        scores = await entry.score_paper("paper-a")

        self.assertEqual(set(scores), {"5", "6"})
        self.assertEqual(scores["5"]["question_attempt_id"], "paper-a:1:5")
        self.assertEqual(scores["6"]["question_attempt_id"], "paper-a:2:6")
        self.assertNotEqual(scores["5"]["feedback"]["summary"], scores["6"]["feedback"]["summary"])
        AutoGraderScoreItem.model_validate(scores["5"])
        manifest = entry.get_manifest("paper-a")
        self.assertIsNotNone(manifest)
        assert manifest is not None
        self.assertEqual(
            {item.question_attempt_id for item in manifest.questions},
            {"paper-a:1:5", "paper-a:2:6"},
        )
        summary = entry.get_paper_score_summary("paper-a")
        self.assertIsNotNone(summary)
        assert summary is not None
        self.assertTrue(summary.complete)
        self.assertEqual(summary.total_score, 16)
        self.assertEqual(summary.total_max_score, 20)
        worker_report = entry.get_worker_report("paper-a")
        self.assertIsNotNone(worker_report)
        assert worker_report is not None
        self.assertEqual(worker_report.batches_completed, 2)
        self.assertEqual(worker_report.attempts_completed, 2)
        snapshot = await pool.snapshot()
        self.assertTrue(all(item.status == QuestionAttemptStatus.COMPLETED for item in snapshot))

    async def test_entry_scores_matching_questions_from_multiple_papers_in_shared_batches(self) -> None:
        scorer = MultiAgentQuestionScorer(
            [
                _FakeEvaluator("one", 8.0),
                _FakeEvaluator("two", 8.0),
                _FakeEvaluator("three", 8.0),
            ],
            arbitrator=None,
        )
        entry = AutoGraderEntry(question_scorer=scorer, recognizer=_DriftingFakeRecognizer())
        for paper_id in ("paper-a", "paper-b"):
            entry._papers[paper_id] = PaperQuestionAnswerPairs(
                paper_id=paper_id,
                pairs=[
                    QuestionAnswerPdfPair(question_label="5", question_pdf=b"q5", answer_pdf=paper_id.encode()),
                    QuestionAnswerPdfPair(question_label="6", question_pdf=b"q6", answer_pdf=paper_id.encode()),
                ],
                metadata={"question_fingerprint": "shared-question-source"},
            )

        results = await entry.score_papers(["paper-a", "paper-b"])
        report = entry.get_worker_report("paper-a")

        self.assertEqual(set(results), {"paper-a", "paper-b"})
        self.assertEqual(results["paper-a"]["5"]["question_attempt_id"], "paper-a:1:5")
        self.assertEqual(results["paper-b"]["5"]["question_attempt_id"], "paper-b:1:5")
        self.assertIsNotNone(report)
        assert report is not None
        self.assertEqual(report.batches_completed, 1)
        self.assertEqual(report.attempts_completed, 2)
        self.assertEqual(report.manual_review_count, 2)

    async def test_batch_rejects_attempt_from_another_canonical_question(self) -> None:
        scorer = MultiAgentQuestionScorer(
            [_FakeEvaluator("one", 8.0), _FakeEvaluator("two", 8.0)],
            arbitrator=None,
        )
        task = QuestionBatchTask(
            task_id="task-1",
            exam_template_id="exam-1",
            canonical_question_id="exam-1:5",
            attempts=[
                _attempt(),
                _attempt(
                    "paper-b:1:6",
                    paper_id="paper-b",
                    canonical_id="exam-1:6",
                    label="6",
                ),
            ],
        )

        with self.assertRaisesRegex(ValueError, "different template"):
            await scorer.score_batch(task)


class PaperAggregatorTests(unittest.TestCase):
    def test_manifest_aggregation_sums_only_the_correct_paper(self) -> None:
        manifest = PaperManifest(
            paper_instance_id="paper-a",
            exam_template_id="exam-1",
            questions=[
                PaperManifestQuestion(
                    question_attempt_id="paper-a:1:5",
                    canonical_question_id="exam-1:5",
                    displayed_label="5",
                    max_score=10,
                ),
                PaperManifestQuestion(
                    question_attempt_id="paper-a:2:6",
                    canonical_question_id="exam-1:6",
                    displayed_label="6",
                    max_score=20,
                ),
            ],
        )
        scores = [
            _score("paper-a:1:5", paper_id="paper-a", canonical_id="exam-1:5", label="5", score=8, max_score=10),
            _score("paper-a:2:6", paper_id="paper-a", canonical_id="exam-1:6", label="6", score=15, max_score=20),
        ]

        result = PaperScoreAggregator.aggregate(manifest, scores)

        self.assertTrue(result.complete)
        self.assertEqual(result.total_score, 23)
        self.assertEqual(result.total_max_score, 30)

    def test_manifest_aggregation_rejects_cross_paper_result(self) -> None:
        manifest = PaperManifest(
            paper_instance_id="paper-a",
            exam_template_id="exam-1",
            questions=[
                PaperManifestQuestion(
                    question_attempt_id="paper-a:1:5",
                    canonical_question_id="exam-1:5",
                    displayed_label="5",
                )
            ],
        )
        foreign_score = _score(
            "paper-b:1:5",
            paper_id="paper-b",
            canonical_id="exam-1:5",
            label="5",
            score=8,
            max_score=10,
        )

        with self.assertRaisesRegex(ValueError, "belongs to paper"):
            PaperScoreAggregator.aggregate(manifest, [foreign_score])


if __name__ == "__main__":
    unittest.main(verbosity=2)
