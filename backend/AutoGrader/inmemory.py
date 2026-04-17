import asyncio
import os
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
    PaperQuestionAnswerPairs,
    SourceType,
)
from .question_splitter import DocumentSplitter, QuestionSplitter


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
                "paper_pairs": {},
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

    async def get_paper_question_answer_pairs(self, job_id: str, paper_id: str) -> PaperQuestionAnswerPairs:
        async with self._lock:
            job = self._jobs.get(job_id)

        if job is None:
            return PaperQuestionAnswerPairs(
                paper_id=paper_id,
                pairs=[],
                metadata={"status": "job_not_found"},
            )

        paper_pairs = job.get("paper_pairs", {}).get(paper_id, [])
        return PaperQuestionAnswerPairs(paper_id=paper_id, pairs=list(paper_pairs))

    async def _run_job(self, job_id: str, items: list[GradeTaskItem]) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["status"] = AutoGradeStatusCode.RUNNING

        results: list[AutoGradePaperResult] = []
        for item in items:
            try:
                pairs = await self._build_pairs_for_item(item)
                async with self._lock:
                    job = self._jobs.get(job_id)
                    if job is not None:
                        job.setdefault("paper_pairs", {})[item.paper_id] = pairs
            except Exception:
                async with self._lock:
                    job = self._jobs.get(job_id)
                    if job is not None:
                        job.setdefault("paper_pairs", {})[item.paper_id] = []

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

    async def _build_pairs_for_item(self, task: GradeTaskItem):
        student_pdf = self._bundle_to_pdf_bytes(task.student_bundle)
        answer_pdf = self._bundle_to_pdf_bytes(task.answer_bundle)
        if student_pdf is None or answer_pdf is None:
            return []
        return await DocumentSplitter.build_question_answer_pairs(student_pdf, answer_pdf, detection_method="llm")

    def _bundle_to_pdf_bytes(self, bundle) -> bytes | None:
        if not bundle.sources:
            return None

        pdf_sources = [s for s in bundle.sources if s.source_type == SourceType.PDF]
        if pdf_sources:
            path = pdf_sources[0].uri
            if os.path.exists(path):
                with open(path, "rb") as f:
                    return f.read()
            return None

        image_sources = [s for s in bundle.sources if s.source_type == SourceType.IMAGE]
        if not image_sources:
            return None

        images: list[bytes] = []
        for source in image_sources:
            if os.path.exists(source.uri):
                with open(source.uri, "rb") as f:
                    images.append(f.read())
        if not images:
            return None
        return QuestionSplitter.combine_images_to_pdf(images)
