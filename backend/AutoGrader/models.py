from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    PDF = "pdf"
    IMAGE = "image"


class BundleKind(str, Enum):
    STUDENT_PAPER = "student_paper"
    ANSWER_KEY = "answer_key"


class AutoGradeStatusCode(str, Enum):
    OK = "OK"
    ACCEPTED = "ACCEPTED"
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    PARTIAL_DONE = "PARTIAL_DONE"
    INVALID_INPUT = "INVALID_INPUT"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    PREPROCESS_FAILED = "PREPROCESS_FAILED"
    TIMEOUT = "TIMEOUT"
    EVAL_ERROR = "EVAL_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class SourceItem(BaseModel):
    source_type: SourceType
    uri: str
    mime_type: Optional[str] = None
    page_hint: Optional[int] = None
    checksum: Optional[str] = None


class DocumentBundle(BaseModel):
    bundle_id: str
    kind: BundleKind
    sources: list[SourceItem] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GradeTaskItem(BaseModel):
    paper_id: str
    student_bundle: DocumentBundle
    answer_bundle: DocumentBundle
    metadata: dict[str, Any] = Field(default_factory=dict)


class QuestionAnswerPdfPair(BaseModel):
    question_label: str
    question_pdf: bytes
    answer_pdf: bytes
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaperQuestionAnswerPairs(BaseModel):
    paper_id: str
    pairs: list[QuestionAnswerPdfPair] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AutoGradeJobSubmitRequest(BaseModel):
    prompt: str
    items: list[GradeTaskItem] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AutoGradeResult(BaseModel):
    score: Optional[float] = None
    status_code: AutoGradeStatusCode = AutoGradeStatusCode.INTERNAL_ERROR
    message: str = ""


class AutoGradePaperResult(BaseModel):
    paper_id: str
    result: AutoGradeResult


class AutoGradeJobSubmitResponse(BaseModel):
    job_id: str
    accepted_count: int = 0
    status_code: AutoGradeStatusCode = AutoGradeStatusCode.ACCEPTED
    message: str = ""


class AutoGradeJobStatusResponse(BaseModel):
    job_id: str
    status_code: AutoGradeStatusCode
    total: int = 0
    completed: int = 0
    message: str = ""


class AutoGradeJobResultsResponse(BaseModel):
    job_id: str
    status_code: AutoGradeStatusCode
    results: list[AutoGradePaperResult] = Field(default_factory=list)
    message: str = ""


class EvaluationResult(BaseModel):
    evaluator_name: str
    score: Optional[float] = None
    status_code: AutoGradeStatusCode = AutoGradeStatusCode.OK
    message: str = ""
    evidence: list[str] = Field(default_factory=list)


class QuestionAttemptStatus(str, Enum):
    PENDING = "pending"
    LEASED = "leased"
    COMPLETED = "completed"
    MANUAL_REVIEW = "manual_review"


class AttemptFeedback(BaseModel):
    """Feedback that belongs to one student's answer to one question."""

    summary: str = ""
    awarded_points: list[str] = Field(default_factory=list)
    deductions: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    suggestion: str | None = None


class QuestionAttempt(BaseModel):
    """Smallest grading unit, with immutable paper and question ownership."""

    paper_instance_id: str
    question_attempt_id: str
    exam_template_id: str
    canonical_question_id: str
    displayed_label: str
    question_pdf: bytes
    answer_pdf: bytes | None = None
    question_text: str | None = None
    answer_text: str | None = None
    grading_criteria: str | None = None
    question_only: bool = False
    status: QuestionAttemptStatus = QuestionAttemptStatus.PENDING
    metadata: dict[str, Any] = Field(default_factory=dict)


class RubricCriterion(BaseModel):
    criterion_id: str
    description: str
    max_points: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class QuestionRubric(BaseModel):
    canonical_question_id: str
    version: str = "initial"
    reference_answer: str | None = None
    max_score: float | None = None
    criteria: list[RubricCriterion] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class QuestionBatchTask(BaseModel):
    """Worker task containing only one canonical question across one or more papers."""

    task_id: str
    exam_template_id: str
    canonical_question_id: str
    rubric_version: str = "initial"
    attempts: list[QuestionAttempt] = Field(default_factory=list)
    rubric: QuestionRubric | None = None
    grading_criteria: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentQuestionEvaluation(BaseModel):
    """One evaluator's result for exactly one question attempt."""

    question_attempt_id: str
    evaluator_name: str
    score: float | None = None
    mode: str = "manual_review"
    max_score: float | None = None
    manual_review: bool = False
    reason: str | None = None
    evidence: list[str] = Field(default_factory=list)
    feedback: AttemptFeedback = Field(default_factory=AttemptFeedback)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConsensusQuestionScore(BaseModel):
    """Deterministically aggregated result for one question attempt."""

    paper_instance_id: str
    question_attempt_id: str
    canonical_question_id: str
    displayed_label: str
    score: float | None = None
    mode: str = "manual_review"
    max_score: float | None = None
    manual_review: bool = False
    reason: str | None = None
    confidence: int = 0
    consensus: str = "low"
    agent_count: int = 0
    arbitrated: bool = False
    rubric_version: str = "initial"
    feedback: AttemptFeedback = Field(default_factory=AttemptFeedback)
    evaluator_names: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaperManifestQuestion(BaseModel):
    question_attempt_id: str
    canonical_question_id: str
    displayed_label: str
    max_score: float | None = None
    required: bool = True


class PaperManifest(BaseModel):
    """Expected question membership used for safe paper-level aggregation."""

    paper_instance_id: str
    exam_template_id: str
    questions: list[PaperManifestQuestion] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaperScoreSummary(BaseModel):
    paper_instance_id: str
    exam_template_id: str
    scores: list[ConsensusQuestionScore] = Field(default_factory=list)
    total_score: float | None = None
    total_max_score: float | None = None
    complete: bool = False
    status_code: AutoGradeStatusCode = AutoGradeStatusCode.PENDING
    message: str = ""


# TODO: Add compatibility-layer models here if we ever need to support the legacy single-file upload protocol.
