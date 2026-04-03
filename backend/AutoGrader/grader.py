from abc import ABC, abstractmethod

from .models import (
    AutoGradeJobResultsResponse,
    AutoGradeJobStatusResponse,
    AutoGradeJobSubmitRequest,
    AutoGradeJobSubmitResponse,
    AutoGradePaperResult,
    AutoGradeResult,
    EvaluationResult,
    GradeTaskItem,
)


class AutoGraderBase(ABC):
    @abstractmethod
    async def submit_job(self, request: AutoGradeJobSubmitRequest) -> AutoGradeJobSubmitResponse:
        """提交一批评分任务。"""

    @abstractmethod
    async def get_job_status(self, job_id: str) -> AutoGradeJobStatusResponse:
        """查询任务状态。"""

    @abstractmethod
    async def get_job_results(self, job_id: str) -> AutoGradeJobResultsResponse:
        """获取任务中的所有试卷结果。"""


class SchedulerBase(ABC):
    @abstractmethod
    async def enqueue(self, request: AutoGradeJobSubmitRequest) -> str:
        """把批量评分请求放入队列。"""

    @abstractmethod
    async def cancel(self, job_id: str) -> None:
        """取消一个尚未完成的任务。"""


class EvaluatorBase(ABC):
    @abstractmethod
    async def evaluate(self, task: GradeTaskItem) -> EvaluationResult:
        """对单份试卷做一个维度或一个模型的评分。"""


class AggregatorBase(ABC):
    @abstractmethod
    def aggregate(self, paper_id: str, results: list[EvaluationResult]) -> AutoGradeResult:
        """聚合多个评估器的结果，产出最终分数。"""


class WorkerPoolBase(ABC):
    @abstractmethod
    async def submit(self, task: GradeTaskItem) -> AutoGradePaperResult:
        """提交单份试卷到 worker 执行。"""


# TODO: 后续在 concrete 模块中实现调度器、worker 和聚合器。
