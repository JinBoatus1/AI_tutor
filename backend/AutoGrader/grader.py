import argparse
import asyncio
import hashlib
import json
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from PIL import Image

from .models import (
    AutoGradeJobResultsResponse,
    AutoGradeJobStatusResponse,
    AutoGradeJobSubmitRequest,
    AutoGradeJobSubmitResponse,
    AutoGradePaperResult,
    AutoGradeResult,
    EvaluationResult,
    GradeTaskItem,
    ConsensusQuestionScore,
    PaperManifest,
    PaperManifestQuestion,
    PaperQuestionAnswerPairs,
    PaperScoreSummary,
    QuestionAttempt,
    QuestionAnswerPdfPair,
    QuestionWorkerRunReport,
)
from .multi_agent import MultiAgentQuestionScorer, PaperScoreAggregator
from .question_pool import InMemoryQuestionPool
from .recognizer import QuestionAnswerRecognizer
from .question_splitter import DocumentSplitter, QuestionDetector, QuestionSplitter
from .worker_pool import ConcurrentQuestionWorkerPool


class AutoGraderBase(ABC):
    @abstractmethod
    async def submit_job(self, request: AutoGradeJobSubmitRequest) -> AutoGradeJobSubmitResponse:
        """Submit a batch of grading tasks."""

    @abstractmethod
    async def get_job_status(self, job_id: str) -> AutoGradeJobStatusResponse:
        """Check the status of a job."""

    @abstractmethod
    async def get_job_results(self, job_id: str) -> AutoGradeJobResultsResponse:
        """Fetch all paper results for a job."""


class SchedulerBase(ABC):
    @abstractmethod
    async def enqueue(self, request: AutoGradeJobSubmitRequest) -> str:
        """Enqueue a batch grading request."""

    @abstractmethod
    async def cancel(self, job_id: str) -> None:
        """Cancel a job that has not finished yet."""


class EvaluatorBase(ABC):
    @abstractmethod
    async def evaluate(self, task: GradeTaskItem) -> EvaluationResult:
        """Evaluate one paper with a single criterion or model."""


class AggregatorBase(ABC):
    @abstractmethod
    def aggregate(self, paper_id: str, results: list[EvaluationResult]) -> AutoGradeResult:
        """Aggregate multiple evaluator outputs into a final score."""


class WorkerPoolBase(ABC):
    @abstractmethod
    async def submit(self, task: GradeTaskItem) -> AutoGradePaperResult:
        """Submit one paper to a worker for execution."""


# The paper-level abstractions above remain as compatibility contracts for the job API.


class AutoGraderEntry:
    """Pair papers and run independent per-question evaluators."""

    def __init__(
        self,
        *,
        question_scorer: MultiAgentQuestionScorer | None = None,
        question_pool: InMemoryQuestionPool | None = None,
        question_worker_pool: ConcurrentQuestionWorkerPool | None = None,
        recognizer: QuestionAnswerRecognizer | None = None,
    ) -> None:
        self._papers: dict[str, PaperQuestionAnswerPairs] = {}
        self._scores: dict[str, dict[str, dict[str, Any]]] = {}
        self._attempts: dict[str, list[QuestionAttempt]] = {}
        self._manifests: dict[str, PaperManifest] = {}
        self._consensus_scores: dict[str, list[ConsensusQuestionScore]] = {}
        self._worker_reports: dict[str, QuestionWorkerRunReport] = {}
        self._paper_temp_dirs: dict[str, Path] = {}
        self._recognizer = recognizer or QuestionAnswerRecognizer()
        if question_worker_pool is not None:
            if question_scorer is not None and question_scorer is not question_worker_pool.scorer:
                raise ValueError("question_scorer must match the supplied question_worker_pool")
            if question_pool is not None and question_pool is not question_worker_pool.question_pool:
                raise ValueError("question_pool must match the supplied question_worker_pool")
            self._question_worker_pool = question_worker_pool
            self._question_scorer = question_worker_pool.scorer
            self._question_pool = question_worker_pool.question_pool
        else:
            self._question_scorer = question_scorer or MultiAgentQuestionScorer.default()
            self._question_pool = question_pool or InMemoryQuestionPool()
            self._question_worker_pool = ConcurrentQuestionWorkerPool(
                self._question_pool,
                self._question_scorer,
            )

    @staticmethod
    def _load_document_bytes(source_path: str | Path) -> bytes:
        path = Path(source_path)
        if path.suffix.lower() == ".pdf":
            return path.read_bytes()

        image = Image.open(path)
        if image.mode != "RGB":
            image = image.convert("RGB")
        return QuestionSplitter.image_to_pdf_bytes(image)

    @staticmethod
    def _normalize_pair_label(label: str) -> str:
        return QuestionDetector.normalize_question_label(label)

    @staticmethod
    def _provisional_template_id(
        pairs: list[QuestionAnswerPdfPair],
        inspections: dict[str, dict[str, Any]] | None = None,
    ) -> str:
        fingerprint_parts: list[bytes] = []
        inspections = inspections or {}
        for pair in pairs:
            label = QuestionDetector.normalize_question_label(pair.question_label)
            question_text = str(inspections.get(label, {}).get("question_text") or "")
            normalized_text = "".join(question_text.lower().split())
            fingerprint_parts.append(normalized_text.encode("utf-8") if normalized_text else pair.question_pdf)
        digest = hashlib.sha256(b"\x00".join(fingerprint_parts)).hexdigest()[:16]
        return f"exam-{digest}"

    @staticmethod
    def _attempt_id(paper_id: str, index: int, label: str) -> str:
        return f"{paper_id}:{index}:{label}"

    @staticmethod
    def _score_item_from_consensus(
        result: ConsensusQuestionScore,
        *,
        question_text: str | None,
        answer_text: str | None,
        question_only: bool,
    ) -> dict[str, Any]:
        resolved_answer_text = result.feedback.summary if question_only and result.feedback.summary else answer_text
        return {
            "score": result.score,
            "mode": result.mode,
            "max_score": result.max_score,
            "manual_review": result.manual_review,
            "reason": result.reason,
            "question_text": question_text,
            "answer_text": resolved_answer_text,
            "paper_instance_id": result.paper_instance_id,
            "question_attempt_id": result.question_attempt_id,
            "canonical_question_id": result.canonical_question_id,
            "confidence": result.confidence,
            "consensus": result.consensus,
            "agent_count": result.agent_count,
            "arbitrated": result.arbitrated,
            "rubric_version": result.rubric_version,
            "feedback": result.feedback.model_dump(),
        }

    @staticmethod
    def _manifest_from_attempts(
        paper_id: str,
        exam_template_id: str,
        attempts: list[QuestionAttempt],
    ) -> PaperManifest:
        return PaperManifest(
            paper_instance_id=paper_id,
            exam_template_id=exam_template_id,
            questions=[
                PaperManifestQuestion(
                    question_attempt_id=attempt.question_attempt_id,
                    canonical_question_id=attempt.canonical_question_id,
                    displayed_label=attempt.displayed_label,
                )
                for attempt in attempts
            ],
        )

    @staticmethod
    def _manual_consensus(attempt: QuestionAttempt, reason: str) -> ConsensusQuestionScore:
        return ConsensusQuestionScore(
            paper_instance_id=attempt.paper_instance_id,
            question_attempt_id=attempt.question_attempt_id,
            canonical_question_id=attempt.canonical_question_id,
            displayed_label=attempt.displayed_label,
            mode="manual_review",
            manual_review=True,
            reason=reason,
            confidence=0,
            consensus="low",
            rubric_version=str(attempt.metadata.get("rubric_version", "initial")),
        )

    @staticmethod
    def _save_pairs_to_temp_dir(paper_id: str, pairs: list[QuestionAnswerPdfPair]) -> Path:
        temp_root = Path(tempfile.mkdtemp(prefix=f"autograder_{paper_id}_"))
        for index, pair in enumerate(pairs, start=1):
            normalized_label = QuestionDetector.normalize_question_label(pair.question_label)
            question_path = temp_root / f"pair_{index:02d}_q_{normalized_label}.pdf"
            answer_path = temp_root / f"pair_{index:02d}_a_{normalized_label}.pdf"
            question_path.write_bytes(pair.question_pdf)
            answer_path.write_bytes(pair.answer_pdf)
        return temp_root

    @staticmethod
    def _save_question_parts_to_temp_dir(paper_id: str, parts: list[tuple[str, bytes]]) -> Path:
        temp_root = Path(tempfile.mkdtemp(prefix=f"autograder_{paper_id}_"))
        for index, (label, question_pdf) in enumerate(parts, start=1):
            normalized_label = QuestionDetector.normalize_question_label(label)
            question_path = temp_root / f"question_{index:02d}_{normalized_label}.pdf"
            question_path.write_bytes(question_pdf)
        return temp_root

    async def pair_paper(self, paper_id: str, question_source: str | Path, answer_source: str | Path) -> PaperQuestionAnswerPairs:
        """Pair one question paper and one answer paper, save temp artifacts, and keep the paper registry."""
        question_pdf = self._load_document_bytes(question_source)
        answer_pdf = self._load_document_bytes(answer_source)

        pairs = await DocumentSplitter.build_question_answer_pairs(
            question_pdf,
            answer_pdf,
            detection_method="llm",
        )

        temp_dir = self._save_pairs_to_temp_dir(paper_id, pairs)
        record = PaperQuestionAnswerPairs(
            paper_id=paper_id,
            pairs=pairs,
            metadata={
                "temp_dir": str(temp_dir),
                "question_source": str(question_source),
                "answer_source": str(answer_source),
                "pair_count": len(pairs),
            },
        )
        self._papers[paper_id] = record
        self._paper_temp_dirs[paper_id] = temp_dir
        return record

    async def pair_question_paper(self, paper_id: str, question_source: str | Path) -> PaperQuestionAnswerPairs:
        """Split one question paper without a separate answer paper."""
        question_pdf = self._load_document_bytes(question_source)
        parts = await DocumentSplitter.split_pdf_by_questions_with_labels(
            question_pdf,
            detection_method="llm",
        )
        if not parts:
            parts = [("question", question_pdf)]

        temp_dir = self._save_question_parts_to_temp_dir(paper_id, parts)
        pairs = [
            QuestionAnswerPdfPair(
                question_label=label,
                question_pdf=question_pdf_part,
                answer_pdf=b"",
                metadata={"question_only": True, "match_index": index},
            )
            for index, (label, question_pdf_part) in enumerate(parts)
        ]
        record = PaperQuestionAnswerPairs(
            paper_id=paper_id,
            pairs=pairs,
            metadata={
                "temp_dir": str(temp_dir),
                "question_source": str(question_source),
                "answer_source": None,
                "pair_count": len(pairs),
                "grading_mode": "question_only",
            },
        )
        self._papers[paper_id] = record
        self._paper_temp_dirs[paper_id] = temp_dir
        return record

    async def score_paper(self, paper_id: str, grading_criteria: str | None = None) -> dict[str, dict[str, Any]]:
        """Recognize pairs once, then grade each question with independent agents."""
        paper = self._papers.get(paper_id)
        if paper is None or not paper.pairs:
            self._scores[paper_id] = {}
            return {}

        inspections = await self._recognizer.inspect_pairs(paper.pairs)
        inspect_by_label = {
            self._normalize_pair_label(label): data
            for label, data in inspections.items()
        }
        exam_template_id = self._provisional_template_id(paper.pairs, inspect_by_label)
        attempts: list[QuestionAttempt] = []
        gradable_attempts: list[QuestionAttempt] = []
        attempt_context: dict[str, dict[str, Any]] = {}
        manual_results: list[ConsensusQuestionScore] = []
        scores: dict[str, dict[str, Any]] = {}

        for index, pair in enumerate(paper.pairs, start=1):
            label = self._normalize_pair_label(pair.question_label)
            attempt_id = self._attempt_id(paper_id, index, label)
            canonical_question_id = f"{exam_template_id}:{index}:{label}"
            inspection = inspect_by_label.get(label)
            attempt = QuestionAttempt(
                paper_instance_id=paper_id,
                question_attempt_id=attempt_id,
                exam_template_id=exam_template_id,
                canonical_question_id=canonical_question_id,
                displayed_label=label,
                question_pdf=pair.question_pdf,
                answer_pdf=pair.answer_pdf,
                question_text=inspection.get("question_text") if inspection else None,
                answer_text=inspection.get("answer_text") if inspection else None,
                grading_criteria=(grading_criteria or "").strip() or None,
                metadata={"rubric_version": "initial", "pair_index": index},
            )
            attempts.append(attempt)
            if not inspection:
                manual = self._manual_consensus(attempt, "Recognition output was missing for this pair")
                manual_results.append(manual)
                scores[label] = self._score_item_from_consensus(
                    manual,
                    question_text=None,
                    answer_text=None,
                    question_only=False,
                )
                continue

            if not inspection.get("can_grade", False):
                manual = self._manual_consensus(
                    attempt,
                    inspection.get("reason") or "The pair is not clear enough for automatic grading",
                )
                manual_results.append(manual)
                scores[label] = self._score_item_from_consensus(
                    manual,
                    question_text=inspection.get("question_text"),
                    answer_text=inspection.get("answer_text"),
                    question_only=False,
                )
                continue

            gradable_attempts.append(attempt)
            attempt_context[attempt_id] = {
                "label": label,
                "question_text": inspection.get("question_text"),
                "answer_text": inspection.get("answer_text"),
            }

        self._attempts[paper_id] = attempts
        self._manifests[paper_id] = self._manifest_from_attempts(paper_id, exam_template_id, attempts)
        if not gradable_attempts:
            self._consensus_scores[paper_id] = manual_results
            self._scores[paper_id] = scores
            return scores

        consensus_results, worker_report = await self._question_worker_pool.score_attempts(gradable_attempts)
        self._worker_reports[paper_id] = worker_report
        for result in consensus_results:
            context = attempt_context[result.question_attempt_id]
            scores[context["label"]] = self._score_item_from_consensus(
                result,
                question_text=context["question_text"],
                answer_text=context["answer_text"],
                question_only=False,
            )
        self._consensus_scores[paper_id] = [*manual_results, *consensus_results]
        self._scores[paper_id] = scores
        return scores

    async def score_question_paper(self, paper_id: str, grading_criteria: str | None = None) -> dict[str, dict[str, Any]]:
        """Use independent agents to derive and verify reference answers per question."""
        paper = self._papers.get(paper_id)
        if paper is None or not paper.pairs:
            self._scores[paper_id] = {}
            return {}

        exam_template_id = self._provisional_template_id(paper.pairs)
        attempts: list[QuestionAttempt] = []
        for index, pair in enumerate(paper.pairs, start=1):
            label = self._normalize_pair_label(pair.question_label)
            attempts.append(
                QuestionAttempt(
                    paper_instance_id=paper_id,
                    question_attempt_id=self._attempt_id(paper_id, index, label),
                    exam_template_id=exam_template_id,
                    canonical_question_id=f"{exam_template_id}:{index}:{label}",
                    displayed_label=label,
                    question_pdf=pair.question_pdf,
                    answer_pdf=None,
                    grading_criteria=(grading_criteria or "").strip() or None,
                    question_only=True,
                    metadata={"rubric_version": "initial", "pair_index": index},
                )
            )

        self._attempts[paper_id] = attempts
        self._manifests[paper_id] = self._manifest_from_attempts(paper_id, exam_template_id, attempts)
        consensus_results, worker_report = await self._question_worker_pool.score_attempts(attempts)
        self._worker_reports[paper_id] = worker_report
        scores = {
            result.displayed_label: self._score_item_from_consensus(
                result,
                question_text=None,
                answer_text=None,
                question_only=True,
            )
            for result in consensus_results
        }
        self._consensus_scores[paper_id] = consensus_results
        self._scores[paper_id] = scores
        return scores

    async def pair_and_score_paper(
        self,
        paper_id: str,
        question_source: str | Path,
        answer_source: str | Path | None = None,
        grading_criteria: str | None = None,
    ) -> dict[str, Any]:
        """Score a paper, with a separate answer paper when available."""
        if answer_source is None:
            record = await self.pair_question_paper(paper_id, question_source)
            scores = await self.score_question_paper(paper_id, grading_criteria)
        else:
            record = await self.pair_paper(paper_id, question_source, answer_source)
            scores = await self.score_paper(paper_id, grading_criteria)
        return {
            "paper_id": record.paper_id,
            "pair_count": len(record.pairs),
            "temp_dir": record.metadata.get("temp_dir"),
            "pairs": [pair.question_label for pair in record.pairs],
            "scores": scores,
            "grading_mode": record.metadata.get("grading_mode", "question_answer"),
        }

    def get_paper(self, paper_id: str) -> PaperQuestionAnswerPairs:
        return self._papers.get(
            paper_id,
            PaperQuestionAnswerPairs(paper_id=paper_id, pairs=[], metadata={"status": "not_found"}),
        )

    def get_scores(self, paper_id: str) -> dict[str, dict[str, Any]]:
        return dict(self._scores.get(paper_id, {}))

    def get_attempts(self, paper_id: str) -> list[QuestionAttempt]:
        return [attempt.model_copy(deep=True) for attempt in self._attempts.get(paper_id, [])]

    def get_manifest(self, paper_id: str) -> PaperManifest | None:
        manifest = self._manifests.get(paper_id)
        return manifest.model_copy(deep=True) if manifest is not None else None

    def get_paper_score_summary(self, paper_id: str) -> PaperScoreSummary | None:
        manifest = self._manifests.get(paper_id)
        if manifest is None:
            return None
        return PaperScoreAggregator.aggregate(
            manifest,
            [score.model_copy(deep=True) for score in self._consensus_scores.get(paper_id, [])],
        )

    def get_worker_report(self, paper_id: str) -> QuestionWorkerRunReport | None:
        report = self._worker_reports.get(paper_id)
        return report.model_copy(deep=True) if report is not None else None


async def _run_cli() -> None:
    parser = argparse.ArgumentParser(description="Pair a question paper with its answer paper and save temp crops.")
    parser.add_argument("--paper-id", required=True, help="Paper identifier")
    parser.add_argument("--question", required=True, help="Question paper image or PDF path")
    parser.add_argument("--answer", help="Optional answer paper image or PDF path")
    parser.add_argument("--grading-criteria", default=None, help="Optional grading criteria text")
    args = parser.parse_args()

    entry = AutoGraderEntry()
    result = await entry.pair_and_score_paper(args.paper_id, args.question, args.answer, args.grading_criteria)
    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(_run_cli())
