"""Product critique evaluation: each persona reviews the web app dialectically."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from deps import create_chat_completion
from evals.config import scenario_by_id
from evals.config import expand_scenario_product_context


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _loads_json(text: str) -> dict[str, Any]:
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
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return {}


def _expand_product_context(scenarios_doc: dict[str, Any], scenario: dict[str, Any]) -> dict[str, Any]:
    return expand_scenario_product_context(scenarios_doc, scenario)


def _transcript(history: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for msg in history:
        role = "User" if msg.get("role") == "simulated_user" else "Tutor"
        lines.append(f"{role}: {msg.get('content', '')}")
    return "\n".join(lines)


def _conversation_metrics(convo_eval: dict[str, Any] | None) -> dict[str, Any]:
    if not convo_eval:
        return {}
    return {
        "overall_score": convo_eval.get("overall_score"),
        "goal_completion_score": convo_eval.get("goal_completion_score"),
        "evaluation_status": convo_eval.get("evaluation_status"),
    }


def evaluate_persona_product_review(
    *,
    simulation: dict[str, Any],
    evaluation: dict[str, Any],
    scenarios_doc: dict[str, Any],
    model: str = "gpt-5.2",
) -> dict[str, Any]:
    """Each persona dialectically reviews the web product after their simulated session."""
    by_id = scenario_by_id(scenarios_doc)
    standards = scenarios_doc.get("evaluation_standards") or {}
    dimensions = standards.get("dimensions") or []

    eval_by_cid = {c["conversation_id"]: c for c in evaluation.get("conversations") or []}
    persona_reviews: list[dict[str, Any]] = []

    for convo in simulation.get("conversations") or []:
        scenario = _expand_product_context(
            scenarios_doc,
            by_id.get(convo.get("scenario_id", ""), {}),
        )
        convo_eval = eval_by_cid.get(convo.get("conversation_id"))
        dim_lines = "\n".join(
            f"- {d.get('id')}: {d.get('label')} — {d.get('desc')}" for d in dimensions
        )
        prompt = f"""你刚刚以「{scenario.get('persona_label', scenario.get('user_id'))}」的身份体验了 AI Tutor Web 应用（通过聊天 tutor 模拟产品交互）。

## 你的身份
{scenario.get('user_profile', '')}

## 你的目标
{scenario.get('goal', '')}

## 产品功能说明
{scenario.get('agent_context', '')}

## 本次对话记录
{_transcript(convo.get('conversation_history') or [])}

## 对话质量指标（参考）
{json.dumps(_conversation_metrics(convo_eval), ensure_ascii=False)}

## 你的评测重点
{scenario.get('evaluation_focus', '')}

## 评测标准（每项 1-5 分）
{dim_lines}

请从该用户视角**辩证地**评价 Web 产品：既说优点也说不足，改进建议必须针对该用户类型的真实需求（不要泛泛而谈）。

Return ONLY valid JSON:
{{
  "persona_label": "{scenario.get('persona_label', '')}",
  "persona_type": "{scenario.get('persona_type', 'student')}",
  "goal_satisfaction": <0-10>,
  "dimension_scores": {{
    "goal_fit": <1-5>,
    "usability": <1-5>,
    "pedagogy": <1-5>,
    "efficiency": <1-5>,
    "trust": <1-5>
  }},
  "feature_scores": {{
    "learning_mode": <1-5>,
    "practice_mode": <1-5>,
    "chat_tutor": <1-5>,
    "grades_tracker": <1-5>,
    "autograder": <1-5>,
    "onboarding": <1-5>
  }},
  "what_worked": ["..."],
  "what_failed": ["..."],
  "improvements": [
    {{"priority": "P0|P1|P2", "area": "模块名", "suggestion": "具体建议", "rationale": "为何对该用户重要"}}
  ],
  "dialectical_analysis": "200字内辩证总结：该用户视角下产品的矛盾与取舍"
}}
"""
        resp = create_chat_completion(
            model=model,
            messages=[
                {"role": "system", "content": "你是用户体验研究员，从特定用户 persona 视角做辩证产品评测。Return only JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        data = _loads_json(resp.choices[0].message.content or "")
        data.setdefault("persona_label", scenario.get("persona_label"))
        data.setdefault("persona_type", scenario.get("persona_type", "student"))
        data["scenario_id"] = convo.get("scenario_id")
        data["user_id"] = scenario.get("user_id")
        data["conversation_id"] = convo.get("conversation_id")
        data["conversation_metrics"] = _conversation_metrics(convo_eval)
        persona_reviews.append(data)

    synthesis = synthesize_comparative_analysis(persona_reviews, scenarios_doc, model=model)

    return {
        "schema_version": "v1",
        "generated_at": _utc_now(),
        "simulation_id": simulation.get("simulation_id"),
        "evaluation_id": evaluation.get("evaluation_id"),
        "persona_reviews": persona_reviews,
        "comparative_synthesis": synthesis,
    }


def synthesize_comparative_analysis(
    persona_reviews: list[dict[str, Any]],
    scenarios_doc: dict[str, Any],
    *,
    model: str = "gpt-5.2",
) -> dict[str, Any]:
    """Synthesize cross-persona comparison and prioritized product roadmap."""
    reviews_json = json.dumps(persona_reviews, ensure_ascii=False, indent=2)
    prompt = f"""以下是 {len(persona_reviews)} 个不同用户 persona 对 AI Tutor Web 产品的辩证评测（以学生为主）。

{reviews_json}

请生成综合对比分析。Return ONLY valid JSON:
{{
  "executive_summary": "150字内 executive summary",
  "persona_rankings": [
    {{"persona_label": "...", "goal_satisfaction": <0-10>, "overall_fit": <1-5>, "one_line_verdict": "..."}}
  ],
  "cross_persona_conflicts": [
    {{"topic": "...", "persona_a": "...", "persona_b": "...", "tension": "矛盾描述"}}
  ],
  "consensus_improvements": [
    {{"priority": "P0|P1|P2", "area": "...", "suggestion": "...", "supported_by": ["persona1", "persona2"]}}
  ],
  "student_only_priorities": [
    {{"priority": "P0|P1|P2", "suggestion": "...", "rationale": "..."}}
  ],
  "feature_heatmap": {{
    "learning_mode": {{"avg": <float>, "weakest_persona": "...", "strongest_persona": "..."}},
    "practice_mode": {{...}},
    "chat_tutor": {{...}},
    "grades_tracker": {{...}},
    "autograder": {{...}},
    "onboarding": {{...}}
  }}
}}
"""
    resp = create_chat_completion(
        model=model,
        messages=[
            {"role": "system", "content": "你是产品策略分析师。Return only JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    data = _loads_json(resp.choices[0].message.content or "")
    data["review_id"] = str(uuid.uuid4())
    data["generated_at"] = _utc_now()
    return data
