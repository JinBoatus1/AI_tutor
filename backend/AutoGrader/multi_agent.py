"""Per-question multi-agent evaluation and deterministic score aggregation."""

from __future__ import annotations

import asyncio
import json
import os
import statistics
from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Any

from deps import create_chat_completion
from .models import (
    AgentQuestionEvaluation,
    AttemptFeedback,
    AutoGradeStatusCode,
    ConsensusQuestionScore,
    PaperManifest,
    PaperScoreSummary,
    QuestionAttempt,
    QuestionBatchTask,
)
from .prompt_loader import get_prompt, render_prompt
from .vision import pdf_first_page_data_url


_VALID_MODES = {"absolute", "percentage", "manual_review"}


def _strip_json_fence(raw_text: str) -> str:
    cleaned = (raw_text or "").strip()
    if not cleaned.startswith("```"):
        return cleaned
    cleaned = cleaned.split("```", 1)[1].strip()
    if cleaned.lower().startswith("json"):
        cleaned = cleaned[4:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


def _as_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class QuestionEvaluatorBase(ABC):
    """Evaluator contract whose input and output both belong to one attempt."""

    evaluator_name: str

    @abstractmethod
    async def evaluate(self, attempt: QuestionAttempt) -> AgentQuestionEvaluation:
        """Evaluate exactly one student's answer to one canonical question."""


class QuestionArbitratorBase(ABC):
    @abstractmethod
    async def arbitrate(
        self,
        attempt: QuestionAttempt,
        evaluations: list[AgentQuestionEvaluation],
    ) -> AgentQuestionEvaluation:
        """Resolve disagreement for exactly one question attempt."""


class LLMQuestionEvaluator(QuestionEvaluatorBase):
    """Independent vision evaluator with a role-specific grading perspective."""

    def __init__(
        self,
        evaluator_name: str,
        role_instruction: str,
        *,
        model: str | None = None,
        completion: Callable[..., Any] = create_chat_completion,
        image_policy: str = "full",
    ) -> None:
        if image_policy not in {"full", "text_only", "answer_verification"}:
            raise ValueError(f"Unsupported evaluator image policy: {image_policy!r}")
        self.evaluator_name = evaluator_name
        self._role_instruction = role_instruction
        self._model = model or os.getenv("AUTOGRADER_MODEL", "gpt-5.2")
        self._completion = completion
        self._image_policy = image_policy

    @staticmethod
    def _parse_evaluation(raw_text: str, attempt: QuestionAttempt, evaluator_name: str) -> AgentQuestionEvaluation:
        parsed = json.loads(_strip_json_fence(raw_text))
        if isinstance(parsed, dict) and isinstance(parsed.get("result"), dict):
            parsed = parsed["result"]
        if not isinstance(parsed, dict):
            raise ValueError("Evaluator output must be a JSON object")

        returned_attempt_id = str(parsed.get("id") or parsed.get("question_attempt_id") or "")
        if returned_attempt_id != attempt.question_attempt_id:
            raise ValueError(
                f"Evaluator returned attempt id {returned_attempt_id!r}; expected {attempt.question_attempt_id!r}"
            )

        mode = str(parsed.get("m") or parsed.get("mode") or "manual_review").lower()
        if mode not in _VALID_MODES:
            mode = "manual_review"

        feedback_raw = parsed.get("fb")
        if not isinstance(feedback_raw, dict):
            feedback_raw = parsed.get("feedback")
        feedback_data = dict(feedback_raw) if isinstance(feedback_raw, dict) else {}
        feedback_data["summary"] = str(feedback_data.get("summary") or "")
        compact_feedback_keys = {
            "awarded_points": "plus",
            "deductions": "minus",
            "evidence": "evidence",
        }
        for field_name, compact_name in compact_feedback_keys.items():
            field_value = feedback_data.get(field_name, feedback_data.get(compact_name))
            feedback_data[field_name] = [str(item) for item in field_value] if isinstance(field_value, list) else []
        if feedback_data.get("suggestion") is None and feedback_data.get("next") is not None:
            feedback_data["suggestion"] = feedback_data["next"]
        if feedback_data.get("suggestion") is not None:
            feedback_data["suggestion"] = str(feedback_data["suggestion"])
        feedback = AttemptFeedback.model_validate(feedback_data)
        evidence = parsed.get("evidence")
        if not isinstance(evidence, list):
            evidence = feedback.evidence

        return AgentQuestionEvaluation(
            question_attempt_id=attempt.question_attempt_id,
            evaluator_name=evaluator_name,
            score=_as_optional_float(parsed.get("s", parsed.get("score"))),
            mode=mode,
            max_score=_as_optional_float(parsed.get("x", parsed.get("max_score"))),
            manual_review=bool(parsed.get("review", parsed.get("manual_review", False)))
            or mode == "manual_review",
            reason=(
                str(parsed.get("why", parsed.get("reason")))
                if parsed.get("why", parsed.get("reason")) is not None
                else None
            ),
            evidence=[str(item) for item in evidence],
            feedback=feedback,
        )

    def _build_messages(self, attempt: QuestionAttempt) -> list[dict[str, Any]]:
        user_content: list[dict[str, Any]] = []
        if attempt.grading_criteria:
            user_content.append(
                {
                    "type": "text",
                    "text": render_prompt(
                        "multi_agent.grading_criteria",
                        grading_criteria=attempt.grading_criteria,
                    ),
                }
            )
        if attempt.question_text:
            user_content.append(
                {
                    "type": "text",
                    "text": render_prompt(
                        "multi_agent.recognized_question",
                        question_text=attempt.question_text,
                    ),
                }
            )
        if self._image_policy == "full" or not attempt.question_text:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": pdf_first_page_data_url(
                            attempt.question_pdf,
                            dpi_env="AUTOGRADER_EVALUATOR_IMAGE_DPI",
                            default_dpi=110,
                        )
                    },
                }
            )
        user_content.append(
            {
                "type": "text",
                "text": render_prompt(
                    "multi_agent.attempt_header",
                    question_attempt_id=attempt.question_attempt_id,
                    displayed_label=attempt.displayed_label,
                ),
            }
        )

        if attempt.question_only:
            user_content.append({"type": "text", "text": get_prompt("multi_agent.question_only")})
        else:
            if attempt.answer_text:
                user_content.append(
                    {
                        "type": "text",
                        "text": render_prompt(
                            "multi_agent.recognized_answer",
                            answer_text=attempt.answer_text,
                        ),
                    }
                )
            should_send_answer_image = self._image_policy in {"full", "answer_verification"} or not attempt.answer_text
            if attempt.answer_pdf and should_send_answer_image:
                user_content.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": pdf_first_page_data_url(
                                attempt.answer_pdf,
                                dpi_env="AUTOGRADER_EVALUATOR_IMAGE_DPI",
                                default_dpi=110,
                            )
                        },
                    }
                )
        user_content.append(
            {
                "type": "text",
                "text": render_prompt(
                    "multi_agent.role_focus",
                    role_instruction=self._role_instruction,
                ),
            }
        )

        return [
            {"role": "system", "content": get_prompt("multi_agent.evaluator_system")},
            {"role": "user", "content": user_content},
        ]

    async def evaluate(self, attempt: QuestionAttempt) -> AgentQuestionEvaluation:
        messages = await asyncio.to_thread(self._build_messages, attempt)
        response = await asyncio.to_thread(
            self._completion,
            model=self._model,
            messages=messages,
            temperature=0.0,
        )
        raw_text = response.choices[0].message.content or ""
        return self._parse_evaluation(raw_text, attempt, self.evaluator_name)


class LLMQuestionArbitrator(QuestionArbitratorBase):
    """Fourth agent used only when deterministic aggregation detects disagreement."""

    def __init__(
        self,
        *,
        model: str | None = None,
        completion: Callable[..., Any] = create_chat_completion,
    ) -> None:
        self._model = model or os.getenv("AUTOGRADER_MODEL", "gpt-5.2")
        self._completion = completion

    async def arbitrate(
        self,
        attempt: QuestionAttempt,
        evaluations: list[AgentQuestionEvaluation],
    ) -> AgentQuestionEvaluation:
        candidates = [
            {
                "name": item.evaluator_name,
                "s": item.score,
                "x": item.max_score,
                "m": item.mode,
                "review": item.manual_review,
                "why": item.reason,
                "summary": item.feedback.summary,
                "minus": item.feedback.deductions,
                "evidence": item.feedback.evidence or item.evidence,
            }
            for item in evaluations
        ]
        evaluator = LLMQuestionEvaluator(
            "arbitrator",
            get_prompt("multi_agent.arbitrator_instruction"),
            model=self._model,
            completion=self._completion,
            image_policy="answer_verification",
        )
        attempt_for_arbitration = attempt.model_copy(
            update={
                "grading_criteria": (
                    f"{attempt.grading_criteria or ''}\n\n"
                    + render_prompt(
                        "multi_agent.arbitration_context",
                        candidates_json=json.dumps(
                            candidates,
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                    )
                ).strip()
            }
        )
        return await evaluator.evaluate(attempt_for_arbitration)


class DeterministicQuestionAggregator:
    """Combine independent scores without asking an LLM to average them."""

    def __init__(self, *, disagreement_threshold: float = 0.15, minimum_quorum: int = 2) -> None:
        self.disagreement_threshold = max(0.01, float(disagreement_threshold))
        self.minimum_quorum = max(1, int(minimum_quorum))

    @staticmethod
    def _valid_ratio(item: AgentQuestionEvaluation, attempt_id: str) -> float | None:
        if item.question_attempt_id != attempt_id or item.manual_review or item.mode == "manual_review":
            return None
        if item.score is None:
            return None
        if item.mode == "absolute":
            if item.max_score is None or item.max_score <= 0 or item.score < 0 or item.score > item.max_score:
                return None
            return item.score / item.max_score
        if item.mode == "percentage":
            if item.score < 0 or item.score > 100:
                return None
            return item.score / 100.0
        return None

    @staticmethod
    def _feedback_nearest_to_median(
        valid: list[tuple[AgentQuestionEvaluation, float]],
        median_ratio: float,
    ) -> tuple[AttemptFeedback, str | None]:
        selected, _ratio = min(valid, key=lambda item: abs(item[1] - median_ratio))
        return selected.feedback, selected.reason

    def aggregate(
        self,
        attempt: QuestionAttempt,
        evaluations: list[AgentQuestionEvaluation],
        *,
        expected_agent_count: int,
    ) -> ConsensusQuestionScore:
        valid = [
            (item, ratio)
            for item in evaluations
            if (ratio := self._valid_ratio(item, attempt.question_attempt_id)) is not None
        ]
        evaluator_names = [item.evaluator_name for item, _ratio in valid]
        if len(valid) < self.minimum_quorum:
            return ConsensusQuestionScore(
                paper_instance_id=attempt.paper_instance_id,
                question_attempt_id=attempt.question_attempt_id,
                canonical_question_id=attempt.canonical_question_id,
                displayed_label=attempt.displayed_label,
                mode="manual_review",
                manual_review=True,
                reason="Fewer than two valid independent evaluator results",
                agent_count=len(valid),
                evaluator_names=evaluator_names,
                rubric_version=str(attempt.metadata.get("rubric_version", "initial")),
                metadata={"needs_arbitration": False},
            )

        ratios = [ratio for _item, ratio in valid]
        median_ratio = statistics.median(ratios)
        spread = max(ratios) - min(ratios)
        modes = {item.mode for item, _ratio in valid}
        absolute_maxes = [item.max_score for item, _ratio in valid if item.mode == "absolute" and item.max_score]
        consensus_max = statistics.median(absolute_maxes) if absolute_maxes else None
        max_conflict = bool(
            consensus_max
            and absolute_maxes
            and max(absolute_maxes) - min(absolute_maxes) > max(0.01, 0.05 * consensus_max)
        )
        mode_conflict = len(modes) > 1
        needs_arbitration = spread > self.disagreement_threshold or max_conflict or mode_conflict

        if consensus_max is not None and not max_conflict and len(absolute_maxes) >= self.minimum_quorum:
            mode = "absolute"
            score = median_ratio * consensus_max
            max_score = consensus_max
        else:
            mode = "percentage"
            score = median_ratio * 100.0
            max_score = None

        coverage = min(1.0, len(valid) / max(1, expected_agent_count))
        agreement = max(0.0, 1.0 - spread)
        consistency = 0.5 if mode_conflict or max_conflict else 1.0
        confidence = round(100 * (0.55 * agreement + 0.25 * coverage + 0.20 * consistency))
        if len(valid) < expected_agent_count:
            confidence = min(confidence, 84)
        if needs_arbitration:
            confidence = min(confidence, 64)
        consensus = "high" if confidence >= 85 else "medium" if confidence >= 65 else "low"
        feedback, reason = self._feedback_nearest_to_median(valid, median_ratio)

        return ConsensusQuestionScore(
            paper_instance_id=attempt.paper_instance_id,
            question_attempt_id=attempt.question_attempt_id,
            canonical_question_id=attempt.canonical_question_id,
            displayed_label=attempt.displayed_label,
            score=round(score, 4),
            mode=mode,
            max_score=round(max_score, 4) if max_score is not None else None,
            manual_review=False,
            reason=reason or "Independent evaluators reached a score consensus",
            confidence=confidence,
            consensus=consensus,
            agent_count=len(valid),
            evaluator_names=evaluator_names,
            rubric_version=str(attempt.metadata.get("rubric_version", "initial")),
            feedback=feedback,
            metadata={
                "needs_arbitration": needs_arbitration,
                "score_spread_ratio": round(spread, 6),
                "mode_conflict": mode_conflict,
                "max_score_conflict": max_conflict,
            },
        )

    def apply_arbitration(
        self,
        attempt: QuestionAttempt,
        base: ConsensusQuestionScore,
        arbitration: AgentQuestionEvaluation,
    ) -> ConsensusQuestionScore:
        ratio = self._valid_ratio(arbitration, attempt.question_attempt_id)
        evaluator_names = [*base.evaluator_names, arbitration.evaluator_name]
        if ratio is None:
            return base.model_copy(
                update={
                    "score": None,
                    "mode": "manual_review",
                    "max_score": None,
                    "manual_review": True,
                    "reason": arbitration.reason or "Arbitration could not resolve evaluator disagreement",
                    "confidence": min(base.confidence, 40),
                    "consensus": "low",
                    "arbitrated": True,
                    "evaluator_names": evaluator_names,
                    "metadata": {**base.metadata, "needs_arbitration": False, "arbitration_resolved": False},
                }
            )

        return base.model_copy(
            update={
                "score": arbitration.score,
                "mode": arbitration.mode,
                "max_score": arbitration.max_score if arbitration.mode == "absolute" else None,
                "manual_review": False,
                "reason": arbitration.reason or "Arbitrator resolved evaluator disagreement",
                "confidence": max(65, min(85, base.confidence + 20)),
                "consensus": "medium",
                "arbitrated": True,
                "feedback": arbitration.feedback,
                "evaluator_names": evaluator_names,
                "metadata": {**base.metadata, "needs_arbitration": False, "arbitration_resolved": True},
            }
        )


class MultiAgentQuestionScorer:
    """Run independent graders concurrently and arbitrate only disputed attempts."""

    def __init__(
        self,
        evaluators: list[QuestionEvaluatorBase],
        *,
        aggregator: DeterministicQuestionAggregator | None = None,
        arbitrator: QuestionArbitratorBase | None = None,
        max_concurrency: int | None = None,
        evaluator_retries: int | None = None,
    ) -> None:
        if len(evaluators) < 2:
            raise ValueError("Multi-agent scoring requires at least two evaluators")
        self.evaluators = evaluators
        self.aggregator = aggregator or DeterministicQuestionAggregator()
        self.arbitrator = arbitrator
        configured_concurrency = max_concurrency or int(os.getenv("AUTOGRADER_MAX_CONCURRENCY", "6"))
        self._semaphore = asyncio.Semaphore(max(1, configured_concurrency))
        configured_retries = (
            evaluator_retries
            if evaluator_retries is not None
            else int(os.getenv("AUTOGRADER_EVALUATOR_RETRIES", "1"))
        )
        self._evaluator_retries = max(0, configured_retries)

    @classmethod
    def default(cls) -> "MultiAgentQuestionScorer":
        evaluator_names = ("solution_verifier", "rubric_grader", "critical_reviewer")
        evaluators = [
            LLMQuestionEvaluator(
                evaluator_name,
                get_prompt(f"multi_agent.roles.{evaluator_name}.instruction"),
                image_policy=get_prompt(f"multi_agent.roles.{evaluator_name}.image_policy"),
            )
            for evaluator_name in evaluator_names
        ]
        threshold = float(os.getenv("AUTOGRADER_DISAGREEMENT_THRESHOLD", "0.15"))
        arbitration_enabled = os.getenv("AUTOGRADER_ENABLE_ARBITRATION", "1").lower() not in {"0", "false", "no"}
        return cls(
            evaluators,
            aggregator=DeterministicQuestionAggregator(disagreement_threshold=threshold),
            arbitrator=LLMQuestionArbitrator() if arbitration_enabled else None,
        )

    async def _evaluate_one(
        self,
        evaluator: QuestionEvaluatorBase,
        attempt: QuestionAttempt,
    ) -> AgentQuestionEvaluation:
        last_error: Exception | None = None
        for _attempt_number in range(self._evaluator_retries + 1):
            try:
                async with self._semaphore:
                    return await evaluator.evaluate(attempt)
            except Exception as exc:
                last_error = exc
        assert last_error is not None
        raise last_error

    async def score_attempt(self, attempt: QuestionAttempt) -> ConsensusQuestionScore:
        raw_results = await asyncio.gather(
            *(self._evaluate_one(evaluator, attempt) for evaluator in self.evaluators),
            return_exceptions=True,
        )
        evaluations = [item for item in raw_results if isinstance(item, AgentQuestionEvaluation)]
        errors = [f"{type(item).__name__}: {item}" for item in raw_results if isinstance(item, BaseException)]
        consensus = self.aggregator.aggregate(
            attempt,
            evaluations,
            expected_agent_count=len(self.evaluators),
        )
        if errors:
            consensus.metadata["evaluator_errors"] = errors

        if consensus.metadata.get("needs_arbitration") and self.arbitrator is not None:
            try:
                async with self._semaphore:
                    arbitration = await self.arbitrator.arbitrate(attempt, evaluations)
                consensus = self.aggregator.apply_arbitration(attempt, consensus, arbitration)
            except Exception as exc:
                consensus.metadata["arbitration_error"] = f"{type(exc).__name__}: {exc}"
                consensus = consensus.model_copy(
                    update={
                        "score": None,
                        "mode": "manual_review",
                        "max_score": None,
                        "manual_review": True,
                        "reason": "Evaluator disagreement could not be arbitrated",
                        "confidence": min(consensus.confidence, 40),
                        "consensus": "low",
                        "arbitrated": True,
                    }
                )
        elif consensus.metadata.get("needs_arbitration"):
            consensus = consensus.model_copy(
                update={
                    "score": None,
                    "mode": "manual_review",
                    "max_score": None,
                    "manual_review": True,
                    "reason": "Independent evaluators disagreed and arbitration is disabled",
                    "confidence": min(consensus.confidence, 40),
                    "consensus": "low",
                }
            )
        return consensus

    async def score_many(self, attempts: list[QuestionAttempt]) -> list[ConsensusQuestionScore]:
        if not attempts:
            return []
        return list(await asyncio.gather(*(self.score_attempt(attempt) for attempt in attempts)))

    async def score_batch(self, task: QuestionBatchTask) -> list[ConsensusQuestionScore]:
        """Grade a worker batch while enforcing its one-canonical-question boundary."""
        prepared_attempts: list[QuestionAttempt] = []
        available_question_texts = [
            attempt.question_text.strip()
            for attempt in task.attempts
            if attempt.question_text and attempt.question_text.strip()
        ]
        canonical_question_text = (
            max(
                available_question_texts,
                key=lambda text: (len("".join(text.split())), text),
            )
            if available_question_texts
            else None
        )
        for attempt in task.attempts:
            if (
                attempt.exam_template_id != task.exam_template_id
                or attempt.canonical_question_id != task.canonical_question_id
                or str(attempt.metadata.get("rubric_version", "initial")) != task.rubric_version
                or attempt.grading_criteria != task.grading_criteria
            ):
                raise ValueError(
                    f"Question batch {task.task_id!r} contains attempt {attempt.question_attempt_id!r} "
                    "from a different template, canonical question, rubric, or grading criteria"
                )
            update: dict[str, Any] = {}
            if canonical_question_text:
                update["question_text"] = canonical_question_text
            if task.rubric is None:
                prepared_attempts.append(attempt.model_copy(update=update) if update else attempt)
                continue
            frozen_rubric = json.dumps(
                task.rubric.model_dump(),
                ensure_ascii=False,
                separators=(",", ":"),
            )
            update["grading_criteria"] = (
                f"{attempt.grading_criteria or ''}\n\n"
                + render_prompt(
                    "multi_agent.rubric_wrapper",
                    rubric_json=frozen_rubric,
                )
            ).strip()
            prepared_attempts.append(
                attempt.model_copy(
                    update=update
                )
            )
        return await self.score_many(prepared_attempts)


class PaperScoreAggregator:
    """Safely join question scores using a paper manifest, never display labels."""

    @staticmethod
    def aggregate(manifest: PaperManifest, scores: list[ConsensusQuestionScore]) -> PaperScoreSummary:
        manifest_ids = [item.question_attempt_id for item in manifest.questions]
        if len(manifest_ids) != len(set(manifest_ids)):
            raise ValueError(f"Paper manifest {manifest.paper_instance_id!r} contains duplicate question attempts")

        score_by_attempt: dict[str, ConsensusQuestionScore] = {}
        for score in scores:
            if score.paper_instance_id != manifest.paper_instance_id:
                raise ValueError(
                    f"Score {score.question_attempt_id!r} belongs to paper {score.paper_instance_id!r}, "
                    f"not {manifest.paper_instance_id!r}"
                )
            if score.question_attempt_id in score_by_attempt:
                raise ValueError(f"Duplicate score for question attempt {score.question_attempt_id!r}")
            score_by_attempt[score.question_attempt_id] = score

        expected_ids = {item.question_attempt_id for item in manifest.questions}
        unexpected_ids = set(score_by_attempt) - expected_ids
        if unexpected_ids:
            raise ValueError(f"Scores contain attempts not present in the paper manifest: {sorted(unexpected_ids)}")

        ordered_scores: list[ConsensusQuestionScore] = []
        total_score = 0.0
        total_max = 0.0
        problems: list[str] = []
        for expected in manifest.questions:
            score = score_by_attempt.get(expected.question_attempt_id)
            if score is None:
                if expected.required:
                    problems.append(f"Missing required question {expected.displayed_label}")
                continue
            if score.canonical_question_id != expected.canonical_question_id:
                raise ValueError(f"Canonical question mismatch for attempt {expected.question_attempt_id!r}")
            ordered_scores.append(score)
            if score.manual_review or score.mode != "absolute" or score.score is None or score.max_score is None:
                if expected.required:
                    problems.append(f"Question {expected.displayed_label} has no final absolute score")
                continue
            if expected.max_score is not None and abs(score.max_score - expected.max_score) > 0.01:
                problems.append(f"Question {expected.displayed_label} max score does not match the manifest")
                continue
            total_score += score.score
            total_max += score.max_score

        complete = not problems
        return PaperScoreSummary(
            paper_instance_id=manifest.paper_instance_id,
            exam_template_id=manifest.exam_template_id,
            scores=ordered_scores,
            total_score=round(total_score, 4) if complete else None,
            total_max_score=round(total_max, 4) if complete else None,
            complete=complete,
            status_code=AutoGradeStatusCode.DONE if complete else AutoGradeStatusCode.PARTIAL_DONE,
            message="; ".join(problems),
        )
