"""Public API declarations for external AutoGrader integrations."""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel, Field

from .models import AttemptFeedback, QuestionWorkerRunReport


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
    paper_instance_id: str | None = Field(default=None, description="Concrete paper that owns this result")
    question_attempt_id: str | None = Field(default=None, description="Concrete answer attempt that owns this result")
    canonical_question_id: str | None = Field(default=None, description="Canonical question used for background grouping")
    confidence: int | None = Field(default=None, ge=0, le=100, description="Deterministic evaluator agreement confidence")
    consensus: Literal["high", "medium", "low"] | None = Field(default=None, description="Human-readable agreement band")
    agent_count: int = Field(default=0, ge=0, description="Number of valid independent evaluator results")
    arbitrated: bool = Field(default=False, description="Whether a disagreement agent resolved this score")
    rubric_version: str | None = Field(default=None, description="Rubric version used by all evaluators")
    feedback: AttemptFeedback | None = Field(default=None, description="Feedback scoped to this exact question attempt")


class AutoGraderGradeRequest(BaseModel):
    """External request contract for one-paper grading."""

    paper_id: str = Field(description="Paper identifier for tracing")
    question_source: str = Field(description="Question paper path (.pdf/.jpg/.jpeg/.png)")
    answer_source: str | None = Field(default=None, description="Optional answer paper path (.pdf/.jpg/.jpeg/.png)")
    grading_criteria: str | None = Field(default=None, description="Optional user-supplied grading criteria")


class AutoGraderGradeResponse(BaseModel):
    """External response contract for one-paper grading."""

    paper_id: str
    pair_count: int
    grading_mode: Literal["question_answer", "question_only"] = Field(
        default="question_answer",
        description="question_answer when an answer file was supplied, question_only otherwise",
    )
    temp_dir: str | None = Field(default=None, description="Temporary directory containing cropped pair PDFs")
    pairs: list[str] = Field(default_factory=list, description="Detected question labels")
    scores: dict[str, AutoGraderScoreItem] = Field(
        default_factory=dict,
        description="Question label -> score object",
    )
    all_absolute: bool = Field(default=False, description="Whether every question has an absolute score")
    total_score: float | None = Field(default=None, description="Paper total when all questions use absolute scores")
    total_max_score: float | None = Field(default=None, description="Paper maximum total when available")


class AutoGraderBatchPaperRequest(BaseModel):
    paper_id: str
    answer_source: str
    display_name: str | None = None


class AutoGraderBatchGradeRequest(BaseModel):
    question_source: str
    papers: list[AutoGraderBatchPaperRequest] = Field(default_factory=list)
    grading_criteria: str | None = None


class AutoGraderBatchPaperResponse(AutoGraderGradeResponse):
    display_name: str


class AutoGraderBatchGradeResponse(BaseModel):
    paper_count: int
    papers: list[AutoGraderBatchPaperResponse] = Field(default_factory=list)
    worker_report: QuestionWorkerRunReport | None = None


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
        grading_criteria=request.grading_criteria,
    )
    return AutoGraderGradeResponse.model_validate(_with_totals(raw_result))


def _with_totals(payload: dict) -> dict:
    result = dict(payload)
    scores = result.get("scores", {})
    all_absolute = bool(scores) and all(
        isinstance(item, dict)
        and item.get("mode") == "absolute"
        and item.get("score") is not None
        and item.get("max_score") is not None
        for item in scores.values()
    )
    result["all_absolute"] = all_absolute
    if all_absolute:
        result["total_score"] = sum(float(item["score"]) for item in scores.values())
        result["total_max_score"] = sum(float(item["max_score"]) for item in scores.values())
    else:
        result["total_score"] = None
        result["total_max_score"] = None
    return result


async def grade_papers_once(request: AutoGraderBatchGradeRequest) -> AutoGraderBatchGradeResponse:
    """Pair several student answer papers, then score matching questions in shared batches."""

    from .grader import AutoGraderEntry

    if not request.papers:
        raise ValueError("At least one answer paper is required for batch grading")

    entry = AutoGraderEntry()
    records = {}
    for paper in request.papers:
        records[paper.paper_id] = await entry.pair_paper(
            paper.paper_id,
            request.question_source,
            paper.answer_source,
        )

    scores_by_paper = await entry.score_papers(
        [paper.paper_id for paper in request.papers],
        request.grading_criteria,
    )
    responses: list[AutoGraderBatchPaperResponse] = []
    for paper in request.papers:
        record = records[paper.paper_id]
        raw_result = _with_totals(
            {
                "paper_id": paper.paper_id,
                "pair_count": len(record.pairs),
                "temp_dir": record.metadata.get("temp_dir"),
                "pairs": [pair.question_label for pair in record.pairs],
                "scores": scores_by_paper.get(paper.paper_id, {}),
                "grading_mode": "question_answer",
                "display_name": paper.display_name or paper.paper_id,
            }
        )
        responses.append(AutoGraderBatchPaperResponse.model_validate(raw_result))

    return AutoGraderBatchGradeResponse(
        paper_count=len(responses),
        papers=responses,
        worker_report=entry.get_worker_report(request.papers[0].paper_id),
    )
