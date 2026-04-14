import asyncio
import uuid

from .grader import AutoGraderBase
from .models import (
    AutoGradeJobResultsResponse,
    AutoGradeJobStatusResponse,
    AutoGradeJobSubmitRequest,
    AutoGradeJobSubmitResponse,
    AutoGradePaperResult,
    AutoGradeResult,
    AutoGradeStatusCode,
    GradeTaskItem,
)


class InMemoryAutoGrader(AutoGraderBase):
    """A minimal async in-memory implementation for MVP testing."""

    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._lock = asyncio.Lock()

    async def submit_job(self, request: AutoGradeJobSubmitRequest) -> AutoGradeJobSubmitResponse:
        job_id = str(uuid.uuid4())
        accepted_count = len(request.items)

        async with self._lock:
            self._jobs[job_id] = {
                "status": AutoGradeStatusCode.PENDING,
                "total": accepted_count,
                "completed": 0,
                "results": [],
            }

        # Fire-and-forget background processing for MVP.
        asyncio.create_task(self._run_job(job_id, request.items))

        return AutoGradeJobSubmitResponse(
            job_id=job_id,
            accepted_count=accepted_count,
            status_code=AutoGradeStatusCode.ACCEPTED,
            message="Job accepted",
        )

    async def get_job_status(self, job_id: str) -> AutoGradeJobStatusResponse:
        async with self._lock:
            job = self._jobs.get(job_id)

        if job is None:
            return AutoGradeJobStatusResponse(
                job_id=job_id,
                status_code=AutoGradeStatusCode.FILE_NOT_FOUND,
                total=0,
                completed=0,
                message="Job not found",
            )

        return AutoGradeJobStatusResponse(
            job_id=job_id,
            status_code=job["status"],
            total=job["total"],
            completed=job["completed"],
            message="",
        )

    async def get_job_results(self, job_id: str) -> AutoGradeJobResultsResponse:
        async with self._lock:
            job = self._jobs.get(job_id)

        if job is None:
            return AutoGradeJobResultsResponse(
                job_id=job_id,
                status_code=AutoGradeStatusCode.FILE_NOT_FOUND,
                results=[],
                message="Job not found",
            )

        return AutoGradeJobResultsResponse(
            job_id=job_id,
            status_code=job["status"],
            results=list(job["results"]),
            message="",
        )

    async def _run_job(self, job_id: str, items: list[GradeTaskItem]) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["status"] = AutoGradeStatusCode.RUNNING

        results: list[AutoGradePaperResult] = []
        for item in items:
            result = self._grade_one(item)
            results.append(AutoGradePaperResult(paper_id=item.paper_id, result=result))

            async with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                job["completed"] += 1

            # Yield control so status polling can observe progress.
            await asyncio.sleep(0)

        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["results"] = results
            job["status"] = AutoGradeStatusCode.DONE

    def _grade_one(self, task: GradeTaskItem) -> AutoGradeResult:
        has_student_sources = len(task.student_bundle.sources) > 0
        has_answer_sources = len(task.answer_bundle.sources) > 0
        if not has_student_sources or not has_answer_sources:
            return AutoGradeResult(
                score=None,
                status_code=AutoGradeStatusCode.INVALID_INPUT,
                message="Both student_bundle and answer_bundle must contain at least one source",
            )

        return AutoGradeResult(
            score=100.0,
            status_code=AutoGradeStatusCode.DONE,
            message="MVP fixed-score grading",
        )
