"""Tests for persona product critique (mocked LLM)."""

from pathlib import Path

from evals.comparative_report import generate_comparative_html
from evals.config import load_scenarios
from evals.pipeline import run_persona_product_review
from evals.tutor_agent import ChatTurn, TutorContext


def _mock_tutor(turns, ctx):
    return "Tutor explains the feature briefly.", {"latency_ms": 1}


def _mock_user_factory(scenario):
    n = {"c": 0}

    def gen(history):
        n["c"] += 1
        if n["c"] >= 2:
            return "###STOP###"
        return f"As {scenario['persona_label']}, I need help with my goal."

    return gen


def _mock_evaluate(simulation, config, scenarios_doc=None):
    return {
        "schema_version": "v1.1",
        "evaluation_id": "e1",
        "simulation_id": simulation.get("simulation_id"),
        "conversations": [
            {
                "conversation_id": c["conversation_id"],
                "goal_completion_score": 0.8,
                "overall_score": 0.75,
                "evaluation_status": "completed",
                "turn_scores": [],
                "unique_error_ids": [],
            }
            for c in simulation.get("conversations", [])
        ],
        "unique_errors": [],
        "error_scenario_mappings": [],
    }


def _mock_persona_review(simulation, evaluation, scenarios_doc, model="gpt-5.2"):
    reviews = []
    for c in simulation.get("conversations", []):
        sid = c["scenario_id"]
        sc = next(s for s in scenarios_doc["scenarios"] if s["scenario_id"] == sid)
        reviews.append(
            {
                "scenario_id": sid,
                "user_id": sc["user_id"],
                "persona_label": sc["persona_label"],
                "persona_type": sc["persona_type"],
                "conversation_id": c["conversation_id"],
                "goal_satisfaction": 6,
                "dimension_scores": {"goal_fit": 3, "usability": 4, "pedagogy": 3, "efficiency": 4, "trust": 3},
                "feature_scores": {"chat_tutor": 4, "practice_mode": 3, "learning_mode": 4},
                "what_worked": ["chat responds"],
                "what_failed": ["too slow for my goal"],
                "improvements": [{"priority": "P1", "area": "chat", "suggestion": "add shortcut", "rationale": "efficiency"}],
                "dialectical_analysis": "辩证分析 mock",
            }
        )
    return {
        "schema_version": "v1",
        "generated_at": "2026-01-01T00:00:00Z",
        "persona_reviews": reviews,
        "comparative_synthesis": {
            "executive_summary": "综合 mock summary",
            "persona_rankings": [{"persona_label": r["persona_label"], "goal_satisfaction": 6, "overall_fit": 3, "one_line_verdict": "ok"} for r in reviews],
            "consensus_improvements": [{"priority": "P1", "area": "chat", "suggestion": "improve", "supported_by": ["a", "b"]}],
            "student_only_priorities": [{"priority": "P0", "suggestion": "student first", "rationale": "core users"}],
            "cross_persona_conflicts": [],
            "feature_heatmap": {},
        },
    }


def test_comparative_html_renders():
    personas_path = Path(__file__).resolve().parent / "evals" / "scenarios" / "user_personas.json"
    doc = load_scenarios(personas_path)
    report = _mock_persona_review(
        {"conversations": [{"scenario_id": doc["scenarios"][0]["scenario_id"], "conversation_id": "c1"}]},
        {},
        doc,
    )
    html = generate_comparative_html(persona_report=report)
    assert "多 Persona 产品辩证评测对比报告" in html
    assert doc["scenarios"][0]["persona_label"] in html


def test_persona_pipeline_mock(tmp_path, monkeypatch):
    import evals.pipeline as pl
    import evals.product_critique as pc

    monkeypatch.setattr(pc, "evaluate_persona_product_review", _mock_persona_review)
    monkeypatch.setattr(pl, "run_evaluation", _mock_evaluate)

    result = run_persona_product_review(
        output_dir=tmp_path / "persona_run",
        scenario_ids=["persona-lazy-homework", "persona-deep-learner"],
        tutor_fn=_mock_tutor,
        user_fn_factory=_mock_user_factory,
    )
    assert (tmp_path / "persona_run" / "comparative_report.html").is_file()
    assert (tmp_path / "persona_run" / "persona_reviews.json").is_file()
    assert result["persona_count"] == 2
