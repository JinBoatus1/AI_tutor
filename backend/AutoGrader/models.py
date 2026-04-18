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


# TODO: 后续如果需要兼容旧版单文件上传协议，可在这里补充兼容层模型。
