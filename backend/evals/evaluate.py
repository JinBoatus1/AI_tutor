"""Evaluate simulated conversations (ArkSim-compatible evaluation.json)."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from deps import create_chat_completion
from evals.config import EvalPipelineConfig, load_scenarios, scenario_by_id

EVALUATOR_VERSION = "ai-tutor-evals-v1.1"

FAILURE_SEVERITY = {
    "false information": "critical",
    "hallucination": "critical",
    "disobey user request": "high",
    "failure to ask for clarification": "medium",
    "lack of specific information": "medium",
    "repetition": "low",
    "no failure": "low",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _loads_json_object(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
    return {}


def _conversation_transcript(history: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for msg in history:
        role = msg.get("role", "")
        label = "User" if role == "simulated_user" else "Assistant"
        lines.append(f"{label}: {msg.get('content', '')}")
    return "\n".join(lines)


def _score_turn(
    *,
    scenario: dict[str, Any],
    history: list[dict[str, Any]],
    turn_id: int,
    assistant_content: str,
    model: str,
) -> dict[str, Any]:
    prior = _conversation_transcript([m for m in history if m.get("turn_id", 0) < turn_id])
    knowledge = "\n".join(k.get("content", "") for k in scenario.get("knowledge", []))
    prompt = f"""You are evaluating an AI math tutor's response in a simulated conversation.

User goal: {scenario.get('goal', '')}
User profile: {scenario.get('user_profile', '')}
Reference knowledge: {knowledge or '(none)'}

Conversation before this assistant turn:
{prior or '(start of conversation)'}

Assistant response to evaluate:
{assistant_content}

Return ONLY valid JSON with these keys:
{{
  "helpfulness": <1-5>,
  "coherence": <1-5>,
  "relevance": <1-5>,
  "faithfulness": <1-5>,
  "behavior_failure": "<one of: no failure, false information, hallucination, disobey user request, failure to ask for clarification, lack of specific information, repetition>",
  "behavior_failure_reason": "<short reason or empty if no failure>"
}}
"""
    resp = create_chat_completion(
        model=model,
        messages=[
            {"role": "system", "content": "Return only JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
    )
    raw = resp.choices[0].message.content or ""
    data = _loads_json_object(raw)
    behavior = str(data.get("behavior_failure") or "no failure").strip().lower()
    scores = []
    for name in ("helpfulness", "coherence", "relevance", "faithfulness"):
        try:
            value = float(data.get(name, 3))
        except (TypeError, ValueError):
            value = 3.0
        value = max(1.0, min(5.0, value))
        scores.append({"name": name, "value": value, "reason": str(data.get(f"{name}_reason") or "")})

    turn_score = sum(s["value"] for s in scores) / len(scores) if scores else 3.0
    return {
        "turn_id": turn_id,
        "scores": scores,
        "turn_score": round(turn_score, 3),
        "turn_behavior_failure": behavior if behavior != "no failure" else None,
        "turn_behavior_failure_reason": str(data.get("behavior_failure_reason") or ""),
        "qual_scores": [{"name": "agent_behavior_failure", "value": behavior}],
        "unique_error_ids": [],
    }


def _score_goal_completion(
    *,
    scenario: dict[str, Any],
    history: list[dict[str, Any]],
    model: str,
) -> tuple[float, str]:
    transcript = _conversation_transcript(history)
    prompt = f"""Rate how fully the simulated user achieved their goal by the end of this conversation.

User goal: {scenario.get('goal', '')}

Full conversation:
{transcript}

Return ONLY valid JSON:
{{"goal_completion_score": <0.0-1.0>, "goal_completion_reason": "<short explanation>"}}
"""
    resp = create_chat_completion(
        model=model,
        messages=[
            {"role": "system", "content": "Return only JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
    )
    data = _loads_json_object(resp.choices[0].message.content or "")
    try:
        score = float(data.get("goal_completion_score", 0.5))
    except (TypeError, ValueError):
        score = 0.5
    score = max(0.0, min(1.0, score))
    return score, str(data.get("goal_completion_reason") or "")


def _overall_status(overall_score: float) -> str:
    if overall_score >= 0.8:
        return "completed"
    if overall_score >= 0.5:
        return "partial_failure"
    return "failed"


def run_evaluation(
    simulation: dict[str, Any],
    config: EvalPipelineConfig,
    *,
    scenarios_doc: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Evaluate simulation output and return ArkSim-compatible evaluation.json payload."""
    scenarios_doc = scenarios_doc or load_scenarios(config.scenario_file_path)
    by_id = scenario_by_id(scenarios_doc)

    evaluation_id = str(uuid.uuid4())
    conversation_evals: list[dict[str, Any]] = []
    error_registry: dict[str, dict[str, Any]] = {}

    for convo in simulation.get("conversations", []):
        scenario = by_id.get(convo.get("scenario_id", ""), {})
        history = convo.get("conversation_history") or []
        turn_scores: list[dict[str, Any]] = []

        assistant_turns = [m for m in history if m.get("role") == "assistant"]
        for msg in assistant_turns:
            turn_id = int(msg.get("turn_id", 0))
            turn_eval = _score_turn(
                scenario=scenario,
                history=history,
                turn_id=turn_id,
                assistant_content=str(msg.get("content") or ""),
                model=config.model,
            )
            turn_scores.append(turn_eval)

        successful_turns = sum(1 for t in turn_scores if not t.get("turn_behavior_failure"))
        total_turns = len(turn_scores) or 1
        turn_success_ratio = successful_turns / total_turns

        goal_score, goal_reason = _score_goal_completion(
            scenario=scenario,
            history=history,
            model=config.model,
        )
        overall_score = round(turn_success_ratio * 0.75 + goal_score * 0.25, 3)

        convo_eval = {
            "conversation_id": convo.get("conversation_id"),
            "goal_completion_score": goal_score,
            "goal_completion_reason": goal_reason,
            "turn_success_ratio": round(turn_success_ratio, 3),
            "overall_score": overall_score,
            "evaluation_status": _overall_status(overall_score),
            "turn_scores": turn_scores,
            "unique_error_ids": [],
        }
        conversation_evals.append(convo_eval)

        for turn in turn_scores:
            failure = turn.get("turn_behavior_failure")
            if not failure:
                continue
            category = failure
            desc = turn.get("turn_behavior_failure_reason") or category
            key = f"{category}::{desc[:120]}"
            if key not in error_registry:
                error_registry[key] = {
                    "unique_error_id": str(uuid.uuid4()),
                    "behavior_failure_category": category,
                    "unique_error_description": desc,
                    "severity": FAILURE_SEVERITY.get(category, "medium"),
                    "occurrences": [],
                }
            err = error_registry[key]
            err["occurrences"].append(
                {
                    "conversation_id": convo.get("conversation_id"),
                    "turn_id": turn.get("turn_id"),
                }
            )
            turn.setdefault("unique_error_ids", []).append(err["unique_error_id"])
            convo_eval["unique_error_ids"].append(err["unique_error_id"])

    unique_errors = list(error_registry.values())
    unique_errors.sort(
        key=lambda e: (
            {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(e.get("severity", "medium"), 2),
            -len(e.get("occurrences") or []),
        )
    )

    scenario_to_errors: dict[str, set[str]] = {}
    for convo, convo_eval in zip(simulation.get("conversations", []), conversation_evals):
        sid = convo.get("scenario_id")
        if not sid:
            continue
        for err_id in convo_eval.get("unique_error_ids") or []:
            scenario_to_errors.setdefault(sid, set()).add(err_id)

    err_id_to_scenarios: dict[str, list[str]] = {}
    for sid, err_ids in scenario_to_errors.items():
        for err_id in err_ids:
            err_id_to_scenarios.setdefault(err_id, []).append(sid)

    error_scenario_mappings = []
    for rank, err in enumerate(unique_errors, start=1):
        err_id = err["unique_error_id"]
        error_scenario_mappings.append(
            {
                "rank": rank,
                "unique_error_id": err_id,
                "error_description": err.get("unique_error_description"),
                "severity": err.get("severity"),
                "scenario_ids": sorted(err_id_to_scenarios.get(err_id, [])),
            }
        )

    return {
        "schema_version": "v1.1",
        "generated_at": _utc_now(),
        "evaluator_version": EVALUATOR_VERSION,
        "evaluation_id": evaluation_id,
        "simulation_id": simulation.get("simulation_id"),
        "conversations": conversation_evals,
        "unique_errors": unique_errors,
        "error_scenario_mappings": error_scenario_mappings,
    }
