"""Generate HTML report and ArkSim focus files from evaluation output."""

from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

from evals.config import load_scenarios, scenario_by_id


def _esc(text: Any) -> str:
    return html.escape(str(text or ""))


def _avg_metric(conversation_evals: list[dict[str, Any]], metric: str) -> float | None:
    values: list[float] = []
    for convo in conversation_evals:
        for turn in convo.get("turn_scores") or []:
            for score in turn.get("scores") or []:
                if score.get("name") == metric:
                    values.append(float(score["value"]))
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def write_focus_files(
    *,
    evaluation: dict[str, Any],
    scenarios_doc: dict[str, Any],
    output_dir: Path,
) -> list[Path]:
    """Write focus/error_N.json and focus/all_failures.json for failing scenarios."""
    focus_dir = output_dir / "focus"
    focus_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    mappings = evaluation.get("error_scenario_mappings") or []
    if not mappings:
        return written

    all_failures: set[str] = set()
    for idx, mapping in enumerate(mappings, start=1):
        scenario_ids = mapping.get("scenario_ids") or []
        if not scenario_ids:
            continue
        all_failures.update(scenario_ids)
        subset = [s for s in scenarios_doc.get("scenarios", []) if s.get("scenario_id") in scenario_ids]
        payload = {"schema_version": scenarios_doc.get("schema_version", "v1"), "scenarios": subset}
        path = focus_dir / f"error_{idx}.json"
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        written.append(path)

    if all_failures:
        subset = [s for s in scenarios_doc.get("scenarios", []) if s.get("scenario_id") in all_failures]
        all_path = focus_dir / "all_failures.json"
        all_path.write_text(
            json.dumps({"schema_version": scenarios_doc.get("schema_version", "v1"), "scenarios": subset}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        written.append(all_path)

    return written


def generate_html_report(
    *,
    simulation: dict[str, Any],
    evaluation: dict[str, Any],
    scenarios_doc: dict[str, Any],
    threshold_results: dict[str, Any] | None = None,
) -> str:
    """Render final_report.html content."""
    by_id = scenario_by_id(scenarios_doc)
    convo_evals = evaluation.get("conversations") or []
    unique_errors = evaluation.get("unique_errors") or []

    avg_helpfulness = _avg_metric(convo_evals, "helpfulness")
    avg_faithfulness = _avg_metric(convo_evals, "faithfulness")
    avg_coherence = _avg_metric(convo_evals, "coherence")
    avg_relevance = _avg_metric(convo_evals, "relevance")
    avg_goal = round(
        sum(float(c.get("goal_completion_score") or 0) for c in convo_evals) / max(len(convo_evals), 1),
        3,
    )
    avg_overall = round(
        sum(float(c.get("overall_score") or 0) for c in convo_evals) / max(len(convo_evals), 1),
        3,
    )

    sim_by_id = {c["conversation_id"]: c for c in simulation.get("conversations") or []}

    rows = []
    for convo_eval in convo_evals:
        cid = convo_eval.get("conversation_id")
        sim = sim_by_id.get(cid, {})
        scenario = by_id.get(sim.get("scenario_id", ""), {})
        rows.append(
            f"""
            <tr>
              <td>{_esc(scenario.get('scenario_id', sim.get('scenario_id')))}</td>
              <td>{_esc(scenario.get('user_id'))}</td>
              <td>{convo_eval.get('overall_score')}</td>
              <td>{convo_eval.get('goal_completion_score')}</td>
              <td>{convo_eval.get('turn_success_ratio')}</td>
              <td><span class="status {_esc(convo_eval.get('evaluation_status'))}">{_esc(convo_eval.get('evaluation_status'))}</span></td>
            </tr>
            """
        )

    error_blocks = []
    for err in unique_errors:
        occ = err.get("occurrences") or []
        occ_lines = "".join(
            f"<li>{_esc(o.get('conversation_id'))} turn {o.get('turn_id')}</li>" for o in occ
        )
        error_blocks.append(
            f"""
            <div class="error-card severity-{_esc(err.get('severity'))}">
              <h3>{_esc(err.get('behavior_failure_category'))} <span class="badge">{_esc(err.get('severity'))}</span></h3>
              <p>{_esc(err.get('unique_error_description'))}</p>
              <p><strong>Occurrences:</strong> {len(occ)}</p>
              <ul>{occ_lines}</ul>
            </div>
            """
        )

    transcript_blocks = []
    for convo in simulation.get("conversations") or []:
        scenario = by_id.get(convo.get("scenario_id", ""), {})
        convo_eval = next(
            (c for c in convo_evals if c.get("conversation_id") == convo.get("conversation_id")),
            {},
        )
        messages = []
        for msg in convo.get("conversation_history") or []:
            role = "User" if msg.get("role") == "simulated_user" else "Assistant"
            messages.append(f"<div class='msg {role.lower()}'><strong>{role}:</strong> {_esc(msg.get('content'))}</div>")
        transcript_blocks.append(
            f"""
            <details>
              <summary>{_esc(scenario.get('scenario_id'))} — overall {convo_eval.get('overall_score', 'n/a')}</summary>
              <p><em>Goal:</em> {_esc(scenario.get('goal'))}</p>
              <div class="transcript">{''.join(messages)}</div>
            </details>
            """
        )

    gates = threshold_results or {}
    gate_html = ""
    if gates:
        gate_html = f"""
        <section>
          <h2>Threshold Gates</h2>
          <p>Passed: <strong>{'YES' if gates.get('passed') else 'NO'}</strong></p>
          <ul>{''.join(f"<li>{_esc(i)}</li>" for i in gates.get('failures') or [])}</ul>
        </section>
        """

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>AI Tutor Eval Report</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; line-height: 1.5; }}
    h1, h2 {{ margin-bottom: 0.5rem; }}
    .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }}
    .metric {{ background: #f6f8fa; border-radius: 8px; padding: 1rem; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 1rem; }}
    th, td {{ border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }}
    th {{ background: #f0f0f0; }}
    .status {{ padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.85rem; }}
    .status.completed {{ background: #dafbe1; }}
    .status.partial_failure {{ background: #fff8c5; }}
    .status.failed {{ background: #ffebe9; }}
    .error-card {{ border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0; }}
    .severity-critical {{ border-left: 4px solid #cf222e; }}
    .severity-high {{ border-left: 4px solid #bf8700; }}
    .severity-medium {{ border-left: 4px solid #0969da; }}
    .severity-low {{ border-left: 4px solid #6e7781; }}
    .badge {{ font-size: 0.75rem; background: #eaeef2; padding: 0.1rem 0.4rem; border-radius: 4px; }}
    .transcript {{ background: #fafafa; padding: 1rem; border-radius: 8px; margin-top: 0.5rem; }}
    .msg {{ margin-bottom: 0.75rem; }}
    .user {{ border-left: 3px solid #0969da; padding-left: 0.75rem; }}
    .assistant {{ border-left: 3px solid #1a7f37; padding-left: 0.75rem; }}
    details {{ margin: 1rem 0; }}
  </style>
</head>
<body>
  <h1>AI Tutor Evaluation Report</h1>
  <p>Simulation ID: {_esc(simulation.get('simulation_id'))}<br/>
     Evaluation ID: {_esc(evaluation.get('evaluation_id'))}<br/>
     Generated: {_esc(evaluation.get('generated_at'))}</p>

  <section>
    <h2>Summary Metrics</h2>
    <div class="metrics">
      <div class="metric"><div>Overall Score</div><strong>{avg_overall}</strong></div>
      <div class="metric"><div>Goal Completion</div><strong>{avg_goal}</strong></div>
      <div class="metric"><div>Helpfulness</div><strong>{avg_helpfulness if avg_helpfulness is not None else 'n/a'}</strong></div>
      <div class="metric"><div>Faithfulness</div><strong>{avg_faithfulness if avg_faithfulness is not None else 'n/a'}</strong></div>
      <div class="metric"><div>Coherence</div><strong>{avg_coherence if avg_coherence is not None else 'n/a'}</strong></div>
      <div class="metric"><div>Relevance</div><strong>{avg_relevance if avg_relevance is not None else 'n/a'}</strong></div>
    </div>
  </section>

  {gate_html}

  <section>
    <h2>Conversations</h2>
    <table>
      <thead><tr><th>Scenario</th><th>Persona</th><th>Overall</th><th>Goal</th><th>Turn Success</th><th>Status</th></tr></thead>
      <tbody>{''.join(rows)}</tbody>
    </table>
  </section>

  <section>
    <h2>Unique Errors ({len(unique_errors)})</h2>
    {''.join(error_blocks) if error_blocks else '<p>No behavior failures detected.</p>'}
  </section>

  <section>
    <h2>Transcripts</h2>
    {''.join(transcript_blocks)}
  </section>
</body>
</html>
"""


def write_report_artifacts(
    *,
    simulation: dict[str, Any],
    evaluation: dict[str, Any],
    scenarios_doc: dict[str, Any],
    output_dir: Path,
    threshold_results: dict[str, Any] | None = None,
    generate_html: bool = True,
) -> dict[str, str]:
    """Write evaluation.json, final_report.html, and focus files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, str] = {}

    sim_path = output_dir / "simulation.json"
    sim_path.write_text(json.dumps(simulation, indent=2, ensure_ascii=False), encoding="utf-8")
    paths["simulation"] = str(sim_path)

    eval_path = output_dir / "evaluation.json"
    eval_path.write_text(json.dumps(evaluation, indent=2, ensure_ascii=False), encoding="utf-8")
    paths["evaluation"] = str(eval_path)

    if generate_html:
        html_path = output_dir / "final_report.html"
        html_path.write_text(
            generate_html_report(
                simulation=simulation,
                evaluation=evaluation,
                scenarios_doc=scenarios_doc,
                threshold_results=threshold_results,
            ),
            encoding="utf-8",
        )
        paths["report"] = str(html_path)

    focus_paths = write_focus_files(
        evaluation=evaluation,
        scenarios_doc=scenarios_doc,
        output_dir=output_dir,
    )
    if focus_paths:
        paths["focus"] = str(focus_paths[0].parent)

    return paths
