"""Pipeline tests with mocked LLM (no API key required)."""

import json
from pathlib import Path

from evals.config import EvalPipelineConfig
from evals.pipeline import run_simulate_evaluate
from evals.tutor_agent import ChatTurn, TutorContext


def _mock_tutor(turns, ctx):
    last = turns[-1].content if turns else ""
    return f"Tutor reply to: {last[:40]}", {"latency_ms": 1}


def _mock_user_factory(scenario):
    calls = {"n": 0}

    def generate(history):
        calls["n"] += 1
        if calls["n"] >= 2:
            return "###STOP###"
        return f"Question from {scenario['user_id']}: step {calls['n']}"

    return generate


def _mock_evaluate(simulation, config, scenarios_doc=None):
    convos = []
    for c in simulation.get("conversations", []):
        convos.append(
            {
                "conversation_id": c["conversation_id"],
                "goal_completion_score": 0.85,
                "goal_completion_reason": "mock ok",
                "turn_success_ratio": 1.0,
                "overall_score": 0.88,
                "evaluation_status": "completed",
                "turn_scores": [
                    {
                        "turn_id": 0,
                        "scores": [
                            {"name": "helpfulness", "value": 4.0},
                            {"name": "faithfulness", "value": 4.0},
                            {"name": "coherence", "value": 4.0},
                            {"name": "relevance", "value": 4.0},
                        ],
                        "turn_score": 4.0,
                        "turn_behavior_failure": None,
                        "turn_behavior_failure_reason": "",
                        "qual_scores": [{"name": "agent_behavior_failure", "value": "no failure"}],
                        "unique_error_ids": [],
                    }
                ],
                "unique_error_ids": [],
            }
        )
    return {
        "schema_version": "v1.1",
        "generated_at": "2026-01-01T00:00:00Z",
        "evaluator_version": "mock",
        "evaluation_id": "eval-mock",
        "simulation_id": simulation.get("simulation_id"),
        "conversations": convos,
        "unique_errors": [],
        "error_scenario_mappings": [],
    }


def test_simulate_evaluate_report_artifacts(tmp_path: Path):
    cfg = EvalPipelineConfig(
        num_conversations_per_scenario=1,
        max_turns=4,
        output_dir=tmp_path / "run1",
    )
    result = run_simulate_evaluate(
        cfg,
        scenario_ids=["tutor-contradiction-basics", "tutor-proof-help-advanced"],
        tutor_fn=_mock_tutor,
        user_fn_factory=_mock_user_factory,
        evaluate_fn=_mock_evaluate,
    )

    assert (tmp_path / "run1" / "simulation.json").is_file()
    assert (tmp_path / "run1" / "evaluation.json").is_file()
    assert (tmp_path / "run1" / "final_report.html").is_file()

    sim = json.loads((tmp_path / "run1" / "simulation.json").read_text(encoding="utf-8"))
    assert len(sim["conversations"]) == 2

    html = (tmp_path / "run1" / "final_report.html").read_text(encoding="utf-8")
    assert "AI Tutor Evaluation Report" in html
    assert result["thresholds"]["passed"] is True
