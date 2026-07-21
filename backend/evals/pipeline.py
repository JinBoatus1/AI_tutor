"""Orchestrate simulate → evaluate → report (ArkSim workflow)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from evals.config import EvalPipelineConfig, load_scenarios
from evals.evaluate import run_evaluation
from evals.report import write_report_artifacts
from evals.simulate import run_simulation
from evals.tutor_agent import ChatTurn, TutorContext


def check_thresholds(
    evaluation: dict[str, Any],
    config: EvalPipelineConfig,
) -> dict[str, Any]:
    """Check numeric and qualitative threshold gates (ArkSim-style)."""
    failures: list[str] = []
    convos = evaluation.get("conversations") or []

    for metric, threshold in (config.numeric_thresholds or {}).items():
        if metric == "goal_completion":
            values = [float(c.get("goal_completion_score") or 0) for c in convos]
            avg = sum(values) / max(len(values), 1)
            if avg < threshold:
                failures.append(f"goal_completion avg {avg:.3f} < {threshold}")
        elif metric == "overall_score":
            values = [float(c.get("overall_score") or 0) for c in convos]
            avg = sum(values) / max(len(values), 1)
            if avg < threshold:
                failures.append(f"overall_score avg {avg:.3f} < {threshold}")
        else:
            turn_values: list[float] = []
            for convo in convos:
                for turn in convo.get("turn_scores") or []:
                    for score in turn.get("scores") or []:
                        if score.get("name") == metric:
                            turn_values.append(float(score["value"]))
            if turn_values:
                avg = sum(turn_values) / len(turn_values)
                if avg < threshold:
                    failures.append(f"{metric} avg {avg:.3f} < {threshold}")

    qual_labels = config.qualitative_failure_labels or {}
    for convo in convos:
        cid = convo.get("conversation_id")
        for turn in convo.get("turn_scores") or []:
            failure = (turn.get("turn_behavior_failure") or "").lower()
            allowed = [x.lower() for x in qual_labels.get("agent_behavior_failure", [])]
            if failure and failure in allowed:
                failures.append(
                    f"qualitative gate: {failure} in conversation {cid} turn {turn.get('turn_id')}"
                )

    return {"passed": len(failures) == 0, "failures": failures}


def run_simulate_evaluate(
    config: EvalPipelineConfig | None = None,
    *,
    output_dir: Path | str | None = None,
    scenario_ids: list[str] | None = None,
    smoke: bool = False,
    tutor_fn: Callable[[list[ChatTurn], TutorContext], tuple[str, dict[str, Any]]] | None = None,
    user_fn_factory: Callable | None = None,
    evaluate_fn: Callable | None = None,
) -> dict[str, Any]:
    """Full ArkSim-style pipeline: simulate → evaluate → write report artifacts."""
    cfg = config or EvalPipelineConfig.from_yaml()
    if smoke:
        cfg.num_conversations_per_scenario = 1
        cfg.max_turns = 4
        if scenario_ids is None:
            doc = load_scenarios(cfg.scenario_file_path)
            scenario_ids = [s["scenario_id"] for s in doc.get("scenarios", [])[:2]]

    if output_dir is not None:
        cfg.output_dir = Path(output_dir)
    elif cfg.output_dir.name == "latest":
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        cfg.output_dir = cfg.output_dir.parent / f"{ts}_{uuid.uuid4().hex[:8]}"

    scenarios_doc = load_scenarios(cfg.scenario_file_path)
    simulation = run_simulation(
        cfg,
        scenario_ids=scenario_ids,
        tutor_fn=tutor_fn,
        user_fn_factory=user_fn_factory,
    )

    if evaluate_fn:
        evaluation = evaluate_fn(simulation, cfg, scenarios_doc=scenarios_doc)
    else:
        evaluation = run_evaluation(simulation, cfg, scenarios_doc=scenarios_doc)

    threshold_results = check_thresholds(evaluation, cfg)
    artifact_paths = write_report_artifacts(
        simulation=simulation,
        evaluation=evaluation,
        scenarios_doc=scenarios_doc,
        output_dir=cfg.output_dir,
        threshold_results=threshold_results,
        generate_html=cfg.generate_html_report,
    )

    convos = evaluation.get("conversations") or []
    return {
        "run_id": cfg.output_dir.name,
        "output_dir": str(cfg.output_dir),
        "simulation_id": simulation.get("simulation_id"),
        "evaluation_id": evaluation.get("evaluation_id"),
        "conversation_count": len(simulation.get("conversations") or []),
        "unique_error_count": len(evaluation.get("unique_errors") or []),
        "thresholds": threshold_results,
        "artifacts": artifact_paths,
        "summary": {
            "avg_overall_score": round(
                sum(float(c.get("overall_score") or 0) for c in convos) / max(len(convos), 1),
                3,
            ),
            "avg_goal_completion": round(
                sum(float(c.get("goal_completion_score") or 0) for c in convos) / max(len(convos), 1),
                3,
            ),
            "statuses": [c.get("evaluation_status") for c in convos],
        },
    }
