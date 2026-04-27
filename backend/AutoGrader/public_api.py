"""Public API declarations for external AutoGrader integrations."""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel, Field


ScoreMode = Literal["absolute", "percentage", "manual_review"]


class AutoGraderScoreItem(BaseModel):
    """Single-question score output.

    - mode=absolute: score/max_score are absolute points for the question.
    - mode=percentage: score is 0-100 percentage, max_score is None.
    - mode=manual_review: the question should be reviewed by a human and is not scored automatically.
    """

    score: float | None = Field(default=None, description="Score value (absolute points or percentage)")
    mode: ScoreMode = Field(description="Scoring mode: absolute, percentage, or manual_review")
    max_score: float | None = Field(default=None, description="Question full marks when mode=absolute")
    manual_review: bool = Field(default=False, description="Whether this question must be reviewed manually")
    reason: str | None = Field(default=None, description="Why the question was skipped or manually reviewed")
    question_text: str | None = Field(default=None, description="Transcribed question text from the recognition stage")
    answer_text: str | None = Field(default=None, description="Transcribed answer text from the recognition stage")


class AutoGraderGradeRequest(BaseModel):
    """External request contract for one-paper grading."""

    paper_id: str = Field(description="Paper identifier for tracing")
    question_source: str = Field(description="Question paper path (.pdf/.jpg/.jpeg/.png)")
    answer_source: str = Field(description="Answer paper path (.pdf/.jpg/.jpeg/.png)")


class AutoGraderGradeResponse(BaseModel):
    """External response contract for one-paper grading."""

    paper_id: str
    pair_count: int
    temp_dir: str | None = Field(default=None, description="Temporary directory containing cropped pair PDFs")
    pairs: list[str] = Field(default_factory=list, description="Detected question labels")
    scores: dict[str, AutoGraderScoreItem] = Field(
        default_factory=dict,
        description="Question label -> score object",
    )


class AutoGraderExternalApi(Protocol):
    """Protocol for external AutoGrader callers."""

    async def grade_paper(self, request: AutoGraderGradeRequest) -> AutoGraderGradeResponse:
        """Grade one paper and return per-question scores."""
        ...


async def grade_paper_once(request: AutoGraderGradeRequest) -> AutoGraderGradeResponse:
    """Stable helper for external code to call the minimal AutoGrader flow."""

    from .grader import AutoGraderEntry

    entry = AutoGraderEntry()
    raw_result = await entry.pair_and_score_paper(
        paper_id=request.paper_id,
        question_source=request.question_source,
        answer_source=request.answer_source,
    )
    return AutoGraderGradeResponse.model_validate(raw_result)
