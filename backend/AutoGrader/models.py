from typing import List, Optional

from pydantic import BaseModel, Field


class AutoGradeRequest(BaseModel):
    student_images_b64: List[str] = Field(default_factory=list)
    standard_images_b64: List[str] = Field(default_factory=list)


class AutoGradeResult(BaseModel):
    score: Optional[float] = None
    status_code: str
    message: str = ""
