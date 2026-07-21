"""Load scenarios and eval config."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_SCENARIOS = _BACKEND_DIR / "evals" / "scenarios" / "scenarios.json"
_DEFAULT_PERSONAS = _BACKEND_DIR / "evals" / "scenarios" / "user_personas.json"
_DEFAULT_CONFIG = _BACKEND_DIR / "eval_config.yaml"


def load_scenarios(path: Path | str | None = None) -> dict[str, Any]:
    p = Path(path) if path else _DEFAULT_SCENARIOS
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def scenario_by_id(scenarios_doc: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {s["scenario_id"]: s for s in scenarios_doc.get("scenarios", [])}


def expand_scenario_product_context(scenarios_doc: dict[str, Any], scenario: dict[str, Any]) -> dict[str, Any]:
    """Replace {{product_context}} placeholder in persona scenarios."""
    product_ctx = scenarios_doc.get("product_context") or ""
    expanded = dict(scenario)
    ctx = str(expanded.get("agent_context") or "")
    if "{{product_context}}" in ctx:
        expanded["agent_context"] = ctx.replace("{{product_context}}", product_ctx)
    elif not ctx.strip() and product_ctx:
        expanded["agent_context"] = product_ctx
    return expanded


def prepare_scenarios_for_simulation(scenarios_doc: dict[str, Any]) -> dict[str, Any]:
    """Return scenarios doc with expanded agent_context for each scenario."""
    return {
        **scenarios_doc,
        "scenarios": [
            expand_scenario_product_context(scenarios_doc, s)
            for s in scenarios_doc.get("scenarios", [])
        ],
    }


def _resolve_backend_path(raw_path: str) -> Path:
    p = Path(raw_path)
    if p.is_absolute():
        return p
    parts = p.parts
    if parts and parts[0] == "backend":
        p = Path(*parts[1:])
    return (_BACKEND_DIR / p).resolve()


@dataclass
class EvalPipelineConfig:
    scenario_file_path: Path = _DEFAULT_SCENARIOS
    num_conversations_per_scenario: int = 1
    max_turns: int = 6
    model: str = "gpt-5.2"
    output_dir: Path = field(default_factory=lambda: _BACKEND_DIR / "data" / "eval" / "runs" / "latest")
    generate_html_report: bool = True
    metrics_to_run: list[str] = field(
        default_factory=lambda: [
            "goal_completion",
            "helpfulness",
            "faithfulness",
            "coherence",
            "relevance",
            "agent_behavior_failure",
        ]
    )
    numeric_thresholds: dict[str, float] = field(
        default_factory=lambda: {
            "goal_completion": 0.7,
            "helpfulness": 3.5,
            "faithfulness": 3.5,
            "coherence": 3.5,
        }
    )
    qualitative_failure_labels: dict[str, list[str]] = field(
        default_factory=lambda: {
            "agent_behavior_failure": [
                "false information",
                "disobey user request",
                "hallucination",
            ]
        }
    )

    @classmethod
    def from_yaml(cls, path: Path | str | None = None) -> "EvalPipelineConfig":
        p = Path(path) if path else _DEFAULT_CONFIG
        if not p.is_file():
            return cls()
        raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        scenario_path = _resolve_backend_path(str(raw.get("scenario_file_path", str(_DEFAULT_SCENARIOS))))
        output_dir = _resolve_backend_path(str(raw.get("output_dir", "data/eval/runs/latest")))
        return cls(
            scenario_file_path=scenario_path,
            num_conversations_per_scenario=int(raw.get("num_conversations_per_scenario", 1)),
            max_turns=int(raw.get("max_turns", 6)),
            model=str(raw.get("model", "gpt-5.2")),
            output_dir=output_dir,
            generate_html_report=bool(raw.get("generate_html_report", True)),
            metrics_to_run=list(raw.get("metrics_to_run") or cls().metrics_to_run),
            numeric_thresholds=dict(raw.get("numeric_thresholds") or cls().numeric_thresholds),
            qualitative_failure_labels=dict(
                raw.get("qualitative_failure_labels") or cls().qualitative_failure_labels
            ),
        )
