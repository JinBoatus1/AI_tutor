from abc import ABC, abstractmethod

from .models import AutoGradeRequest, AutoGradeResult


class AutoGraderBase(ABC):
    @abstractmethod
    async def grade(self, request: AutoGradeRequest) -> AutoGradeResult:
        """Grade student answer images against standard answer images."""


class PlaceholderAutoGrader(AutoGraderBase):
    async def grade(self, request: AutoGradeRequest) -> AutoGradeResult:
        if not request.student_images_b64:
            return AutoGradeResult(
                score=None,
                status_code="INVALID_INPUT",
                message="student_images_b64 is required",
            )
        if not request.standard_images_b64:
            return AutoGradeResult(
                score=None,
                status_code="INVALID_INPUT",
                message="standard_images_b64 is required",
            )

        return AutoGradeResult(
            score=None,
            status_code="NOT_IMPLEMENTED",
            message="AutoGrader scoring algorithm is not implemented yet.",
        )
