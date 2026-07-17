"""In-memory per-question pool with canonical-question batching and leases."""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass

from .models import QuestionAttempt, QuestionAttemptStatus, QuestionBatchTask


@dataclass
class _PoolRecord:
    attempt: QuestionAttempt
    enqueued_at: float
    lease_id: str | None = None
    lease_expires_at: float | None = None


class InMemoryQuestionPool:
    """Foundation scheduler for batching one canonical question across papers."""

    def __init__(self) -> None:
        self._records: dict[str, _PoolRecord] = {}
        self._lock = asyncio.Lock()

    async def add_attempts(self, attempts: list[QuestionAttempt]) -> None:
        now = time.monotonic()
        async with self._lock:
            for attempt in attempts:
                existing = self._records.get(attempt.question_attempt_id)
                if existing is not None:
                    if (
                        existing.attempt.paper_instance_id != attempt.paper_instance_id
                        or existing.attempt.canonical_question_id != attempt.canonical_question_id
                        or existing.attempt.displayed_label != attempt.displayed_label
                        or existing.attempt.question_pdf != attempt.question_pdf
                        or existing.attempt.answer_pdf != attempt.answer_pdf
                        or existing.attempt.grading_criteria != attempt.grading_criteria
                    ):
                        raise ValueError(f"Question attempt id collision: {attempt.question_attempt_id!r}")
                    continue
                self._records[attempt.question_attempt_id] = _PoolRecord(
                    attempt=attempt.model_copy(deep=True),
                    enqueued_at=now,
                )

    def _release_expired_leases(self, now: float) -> None:
        for record in self._records.values():
            if (
                record.attempt.status == QuestionAttemptStatus.LEASED
                and record.lease_expires_at is not None
                and record.lease_expires_at <= now
            ):
                record.attempt.status = QuestionAttemptStatus.PENDING
                record.lease_id = None
                record.lease_expires_at = None

    async def lease_next_batch(
        self,
        *,
        max_batch_size: int = 16,
        lease_seconds: float = 120.0,
    ) -> QuestionBatchTask | None:
        max_batch_size = max(1, int(max_batch_size))
        now = time.monotonic()
        async with self._lock:
            self._release_expired_leases(now)
            groups: dict[tuple[str, str, str, str | None], list[_PoolRecord]] = {}
            for record in self._records.values():
                if record.attempt.status != QuestionAttemptStatus.PENDING:
                    continue
                key = (
                    record.attempt.exam_template_id,
                    record.attempt.canonical_question_id,
                    str(record.attempt.metadata.get("rubric_version", "initial")),
                    record.attempt.grading_criteria,
                )
                groups.setdefault(key, []).append(record)
            if not groups:
                return None

            # Batch fullness is primary; age breaks ties so small/rare templates are not starved.
            selected_key, selected_records = max(
                groups.items(),
                key=lambda item: (
                    min(len(item[1]), max_batch_size),
                    now - min(record.enqueued_at for record in item[1]),
                ),
            )
            selected_records.sort(key=lambda record: record.enqueued_at)
            selected_records = selected_records[:max_batch_size]
            lease_id = str(uuid.uuid4())
            expires_at = now + max(1.0, float(lease_seconds))
            for record in selected_records:
                record.attempt.status = QuestionAttemptStatus.LEASED
                record.lease_id = lease_id
                record.lease_expires_at = expires_at

            exam_template_id, canonical_question_id, rubric_version, grading_criteria = selected_key
            return QuestionBatchTask(
                task_id=lease_id,
                exam_template_id=exam_template_id,
                canonical_question_id=canonical_question_id,
                rubric_version=rubric_version,
                attempts=[record.attempt.model_copy(deep=True) for record in selected_records],
                grading_criteria=grading_criteria,
                metadata={"lease_expires_at_monotonic": expires_at},
            )

    async def complete_batch(self, task: QuestionBatchTask, *, manual_review_ids: set[str] | None = None) -> None:
        manual_review_ids = manual_review_ids or set()
        now = time.monotonic()
        async with self._lock:
            for attempt in task.attempts:
                record = self._records.get(attempt.question_attempt_id)
                if record is None or record.lease_id != task.task_id:
                    raise ValueError(f"Task {task.task_id!r} does not own attempt {attempt.question_attempt_id!r}")
                if record.lease_expires_at is None or record.lease_expires_at <= now:
                    raise ValueError(f"Task {task.task_id!r} lease expired before completion")
                record.attempt.status = (
                    QuestionAttemptStatus.MANUAL_REVIEW
                    if attempt.question_attempt_id in manual_review_ids
                    else QuestionAttemptStatus.COMPLETED
                )
                record.lease_id = None
                record.lease_expires_at = None

    async def mark_direct_results(
        self,
        attempt_ids: set[str],
        *,
        manual_review_ids: set[str] | None = None,
    ) -> None:
        """Record results produced by the compatibility path before job workers are enabled."""
        manual_review_ids = manual_review_ids or set()
        async with self._lock:
            for attempt_id in attempt_ids:
                record = self._records.get(attempt_id)
                if record is None:
                    raise ValueError(f"Unknown question attempt {attempt_id!r}")
                if record.attempt.status == QuestionAttemptStatus.LEASED:
                    raise ValueError(f"Cannot directly complete leased question attempt {attempt_id!r}")
                record.attempt.status = (
                    QuestionAttemptStatus.MANUAL_REVIEW
                    if attempt_id in manual_review_ids
                    else QuestionAttemptStatus.COMPLETED
                )

    async def release_batch(self, task: QuestionBatchTask) -> None:
        async with self._lock:
            for attempt in task.attempts:
                record = self._records.get(attempt.question_attempt_id)
                if record is None or record.lease_id != task.task_id:
                    continue
                record.attempt.status = QuestionAttemptStatus.PENDING
                record.lease_id = None
                record.lease_expires_at = None

    async def snapshot(self) -> list[QuestionAttempt]:
        async with self._lock:
            return [record.attempt.model_copy(deep=True) for record in self._records.values()]
