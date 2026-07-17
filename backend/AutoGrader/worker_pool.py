"""Concurrent workers for canonical-question batches and safe multi-paper joins."""

from __future__ import annotations

import asyncio
import os
from collections.abc import Iterable
from typing import Protocol

from .models import (
    ConsensusQuestionScore,
    PaperManifest,
    PaperScoreSummary,
    QuestionAttempt,
    QuestionBatchTask,
    QuestionRubric,
    QuestionWorkerRunReport,
)
from .multi_agent import PaperScoreAggregator
from .question_pool import InMemoryQuestionPool


class QuestionBatchScorer(Protocol):
    async def score_batch(self, task: QuestionBatchTask) -> list[ConsensusQuestionScore]:
        """Score one canonical-question batch."""


class InMemoryQuestionResultStore:
    """Idempotent result store keyed by immutable question attempt ids."""

    def __init__(self) -> None:
        self._results: dict[tuple[str, str], ConsensusQuestionScore] = {}
        self._latest_versions: dict[str, str] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _validate_result_ownership(
        attempt: QuestionAttempt,
        result: ConsensusQuestionScore,
    ) -> None:
        if result.question_attempt_id != attempt.question_attempt_id:
            raise ValueError(
                f"Result id {result.question_attempt_id!r} does not match attempt "
                f"{attempt.question_attempt_id!r}"
            )
        if result.paper_instance_id != attempt.paper_instance_id:
            raise ValueError(
                f"Result {result.question_attempt_id!r} belongs to paper "
                f"{result.paper_instance_id!r}, expected {attempt.paper_instance_id!r}"
            )
        if result.canonical_question_id != attempt.canonical_question_id:
            raise ValueError(
                f"Result {result.question_attempt_id!r} belongs to canonical question "
                f"{result.canonical_question_id!r}, expected {attempt.canonical_question_id!r}"
            )

    async def save_batch(
        self,
        task: QuestionBatchTask,
        results: list[ConsensusQuestionScore],
    ) -> list[ConsensusQuestionScore]:
        attempt_by_id = {attempt.question_attempt_id: attempt for attempt in task.attempts}
        if len(attempt_by_id) != len(task.attempts):
            raise ValueError(f"Task {task.task_id!r} contains duplicate question attempt ids")

        result_by_id: dict[str, ConsensusQuestionScore] = {}
        for result in results:
            if result.question_attempt_id in result_by_id:
                raise ValueError(f"Duplicate result for question attempt {result.question_attempt_id!r}")
            attempt = attempt_by_id.get(result.question_attempt_id)
            if attempt is None:
                raise ValueError(
                    f"Task {task.task_id!r} received unexpected result {result.question_attempt_id!r}"
                )
            self._validate_result_ownership(attempt, result)
            if result.rubric_version != task.rubric_version:
                raise ValueError(
                    f"Result {result.question_attempt_id!r} used rubric {result.rubric_version!r}, "
                    f"expected {task.rubric_version!r}"
                )
            result_by_id[result.question_attempt_id] = result

        missing_ids = set(attempt_by_id) - set(result_by_id)
        if missing_ids:
            raise ValueError(f"Task {task.task_id!r} is missing results for {sorted(missing_ids)}")

        persisted: list[ConsensusQuestionScore] = []
        async with self._lock:
            for attempt in task.attempts:
                attempt_id = attempt.question_attempt_id
                result_key = (attempt_id, task.rubric_version)
                existing = self._results.get(result_key)
                if existing is not None:
                    if (
                        existing.paper_instance_id != attempt.paper_instance_id
                        or existing.canonical_question_id != attempt.canonical_question_id
                    ):
                        raise ValueError(f"Stored result ownership collision for {attempt_id!r}")
                    persisted.append(existing.model_copy(deep=True))
                    continue
                result = result_by_id[attempt_id].model_copy(deep=True)
                self._results[result_key] = result
                self._latest_versions[attempt_id] = task.rubric_version
                persisted.append(result.model_copy(deep=True))
        return persisted

    async def get_many(self, attempt_ids: Iterable[str]) -> list[ConsensusQuestionScore]:
        async with self._lock:
            results: list[ConsensusQuestionScore] = []
            for attempt_id in attempt_ids:
                version = self._latest_versions.get(attempt_id)
                if version is not None:
                    results.append(self._results[(attempt_id, version)].model_copy(deep=True))
            return results

    async def get_for_paper(self, paper_instance_id: str) -> list[ConsensusQuestionScore]:
        async with self._lock:
            return [
                self._results[(attempt_id, version)].model_copy(deep=True)
                for attempt_id, version in self._latest_versions.items()
                if self._results[(attempt_id, version)].paper_instance_id == paper_instance_id
            ]

    async def snapshot(self) -> dict[str, ConsensusQuestionScore]:
        async with self._lock:
            return {
                f"{attempt_id}@{version}": result.model_copy(deep=True)
                for (attempt_id, version), result in self._results.items()
            }


class ConcurrentQuestionWorkerPool:
    """Async worker tasks; blocking model calls are delegated to threads by the scorer."""

    def __init__(
        self,
        question_pool: InMemoryQuestionPool,
        scorer: QuestionBatchScorer,
        *,
        result_store: InMemoryQuestionResultStore | None = None,
        worker_count: int | None = None,
        max_batch_size: int | None = None,
        lease_seconds: float | None = None,
        max_batch_retries: int | None = None,
    ) -> None:
        self.question_pool = question_pool
        self.scorer = scorer
        self.result_store = result_store or InMemoryQuestionResultStore()
        self.worker_count = max(
            1,
            worker_count if worker_count is not None else int(os.getenv("AUTOGRADER_QUESTION_WORKERS", "4")),
        )
        self.max_batch_size = max(
            1,
            max_batch_size if max_batch_size is not None else int(os.getenv("AUTOGRADER_QUESTION_BATCH_SIZE", "16")),
        )
        self.lease_seconds = max(
            3.0,
            lease_seconds if lease_seconds is not None else float(os.getenv("AUTOGRADER_QUESTION_LEASE_SECONDS", "300")),
        )
        self.max_batch_retries = max(
            0,
            max_batch_retries
            if max_batch_retries is not None
            else int(os.getenv("AUTOGRADER_QUESTION_BATCH_RETRIES", "1")),
        )
        self._run_lock = asyncio.Lock()
        self._failure_counts: dict[tuple[str, ...], int] = {}
        self._failure_lock = asyncio.Lock()

    async def _heartbeat(self, task: QuestionBatchTask) -> None:
        interval = max(1.0, self.lease_seconds / 3.0)
        while True:
            await asyncio.sleep(interval)
            await self.question_pool.renew_batch(task, lease_seconds=self.lease_seconds)

    @staticmethod
    def _manual_results(task: QuestionBatchTask, reason: str) -> list[ConsensusQuestionScore]:
        return [
            ConsensusQuestionScore(
                paper_instance_id=attempt.paper_instance_id,
                question_attempt_id=attempt.question_attempt_id,
                canonical_question_id=attempt.canonical_question_id,
                displayed_label=attempt.displayed_label,
                mode="manual_review",
                manual_review=True,
                reason=reason,
                confidence=0,
                consensus="low",
                rubric_version=task.rubric_version,
                metadata={"worker_failed": True},
            )
            for attempt in task.attempts
        ]

    async def _record_failure(self, task: QuestionBatchTask) -> int:
        key = (
            f"rubric:{task.rubric_version}",
            *sorted(attempt.question_attempt_id for attempt in task.attempts),
        )
        async with self._failure_lock:
            count = self._failure_counts.get(key, 0) + 1
            self._failure_counts[key] = count
            return count

    async def _clear_failures(self, task: QuestionBatchTask) -> None:
        key = (
            f"rubric:{task.rubric_version}",
            *sorted(attempt.question_attempt_id for attempt in task.attempts),
        )
        async with self._failure_lock:
            self._failure_counts.pop(key, None)

    async def _worker(self, report: QuestionWorkerRunReport) -> None:
        while True:
            task = await self.question_pool.lease_next_batch(
                max_batch_size=self.max_batch_size,
                lease_seconds=self.lease_seconds,
            )
            if task is None:
                return

            heartbeat = asyncio.create_task(self._heartbeat(task))
            try:
                raw_results = await self.scorer.score_batch(task)
                persisted_results = await self.result_store.save_batch(task, raw_results)
                manual_ids = {
                    result.question_attempt_id
                    for result in persisted_results
                    if result.manual_review
                }
                await self.question_pool.complete_batch(task, manual_review_ids=manual_ids)
                await self._clear_failures(task)
                report.batches_completed += 1
                report.attempts_completed += len(persisted_results)
                report.manual_review_count += len(manual_ids)
            except asyncio.CancelledError:
                await self.question_pool.release_batch(task)
                raise
            except Exception as exc:
                failure_count = await self._record_failure(task)
                error = f"{type(exc).__name__}: {exc}"
                report.errors.append(error)
                if failure_count <= self.max_batch_retries:
                    report.retried_batches += 1
                    await self.question_pool.release_batch(task)
                else:
                    manual_results = self._manual_results(
                        task,
                        f"Question worker failed after {failure_count} attempts: {error}",
                    )
                    persisted_results = await self.result_store.save_batch(task, manual_results)
                    manual_ids = {
                        result.question_attempt_id
                        for result in persisted_results
                        if result.manual_review
                    }
                    await self.question_pool.complete_batch(
                        task,
                        manual_review_ids=manual_ids,
                    )
                    report.failed_batches += 1
                    report.batches_completed += 1
                    report.attempts_completed += len(persisted_results)
                    report.manual_review_count += len(manual_ids)
            finally:
                heartbeat.cancel()
                await asyncio.gather(heartbeat, return_exceptions=True)
                await asyncio.sleep(0)

    async def run_until_idle(self) -> QuestionWorkerRunReport:
        async with self._run_lock:
            report = QuestionWorkerRunReport(worker_count=self.worker_count)
            await asyncio.gather(*(self._worker(report) for _index in range(self.worker_count)))
            return report

    async def score_attempts(
        self,
        attempts: list[QuestionAttempt],
        *,
        rubrics: list[QuestionRubric] | None = None,
    ) -> tuple[list[ConsensusQuestionScore], QuestionWorkerRunReport]:
        for rubric in rubrics or []:
            await self.question_pool.register_rubric(rubric)
        await self.question_pool.add_attempts(attempts)
        report = await self.run_until_idle()
        results = await self.result_store.get_many(attempt.question_attempt_id for attempt in attempts)
        result_by_id = {result.question_attempt_id: result for result in results}
        return (
            [
                result_by_id[attempt.question_attempt_id]
                for attempt in attempts
                if attempt.question_attempt_id in result_by_id
            ],
            report,
        )


class MultiPaperGradingCoordinator:
    """Register many papers, process a shared question pool, then aggregate by manifest."""

    def __init__(self, worker_pool: ConcurrentQuestionWorkerPool) -> None:
        self.worker_pool = worker_pool
        self._manifests: dict[str, PaperManifest] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _validate_paper_registration(
        manifest: PaperManifest,
        attempts: list[QuestionAttempt],
    ) -> None:
        manifest_by_id = {item.question_attempt_id: item for item in manifest.questions}
        if len(manifest_by_id) != len(manifest.questions):
            raise ValueError(f"Paper manifest {manifest.paper_instance_id!r} contains duplicate attempts")
        attempt_by_id = {attempt.question_attempt_id: attempt for attempt in attempts}
        if len(attempt_by_id) != len(attempts):
            raise ValueError(f"Paper {manifest.paper_instance_id!r} contains duplicate attempts")
        if set(manifest_by_id) != set(attempt_by_id):
            raise ValueError(
                f"Paper {manifest.paper_instance_id!r} attempts do not exactly match its manifest"
            )
        for attempt_id, attempt in attempt_by_id.items():
            expected = manifest_by_id[attempt_id]
            if attempt.paper_instance_id != manifest.paper_instance_id:
                raise ValueError(f"Attempt {attempt_id!r} belongs to another paper")
            if attempt.exam_template_id != manifest.exam_template_id:
                raise ValueError(f"Attempt {attempt_id!r} belongs to another exam template")
            if attempt.canonical_question_id != expected.canonical_question_id:
                raise ValueError(f"Attempt {attempt_id!r} canonical question does not match the manifest")

    async def register_paper(
        self,
        manifest: PaperManifest,
        attempts: list[QuestionAttempt],
        *,
        rubrics: list[QuestionRubric] | None = None,
    ) -> None:
        self._validate_paper_registration(manifest, attempts)
        canonical_versions = {
            (
                attempt.canonical_question_id,
                str(attempt.metadata.get("rubric_version", "initial")),
            )
            for attempt in attempts
        }
        for rubric in rubrics or []:
            if (rubric.canonical_question_id, rubric.version) not in canonical_versions:
                raise ValueError(
                    f"Rubric {rubric.canonical_question_id!r}@{rubric.version!r} "
                    f"does not belong to paper {manifest.paper_instance_id!r}"
                )
        async with self._lock:
            existing = self._manifests.get(manifest.paper_instance_id)
            if existing is not None and existing != manifest:
                raise ValueError(f"Paper manifest collision for {manifest.paper_instance_id!r}")
            for rubric in rubrics or []:
                await self.worker_pool.question_pool.register_rubric(rubric)
            await self.worker_pool.question_pool.add_attempts(attempts)
            self._manifests[manifest.paper_instance_id] = manifest.model_copy(deep=True)

    async def run_until_idle(self) -> QuestionWorkerRunReport:
        return await self.worker_pool.run_until_idle()

    async def get_paper_summary(self, paper_instance_id: str) -> PaperScoreSummary | None:
        async with self._lock:
            manifest = self._manifests.get(paper_instance_id)
            manifest = manifest.model_copy(deep=True) if manifest is not None else None
        if manifest is None:
            return None
        scores = await self.worker_pool.result_store.get_for_paper(paper_instance_id)
        return PaperScoreAggregator.aggregate(manifest, scores)

    async def get_all_paper_summaries(self) -> list[PaperScoreSummary]:
        async with self._lock:
            paper_ids = list(self._manifests)
        summaries = await asyncio.gather(*(self.get_paper_summary(paper_id) for paper_id in paper_ids))
        return [summary for summary in summaries if summary is not None]
