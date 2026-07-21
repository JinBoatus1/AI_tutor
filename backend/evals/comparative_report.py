"""Comparative HTML report for multi-persona product reviews."""

from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any


def _esc(text: Any) -> str:
    return html.escape(str(text or ""))


def _avg_feature(reviews: list[dict[str, Any]], key: str) -> float | None:
    vals: list[float] = []
    for r in reviews:
        fs = r.get("feature_scores") or {}
        if key in fs:
            try:
                vals.append(float(fs[key]))
            except (TypeError, ValueError):
                pass
    return round(sum(vals) / len(vals), 2) if vals else None


def generate_comparative_html(
    *,
    persona_report: dict[str, Any],
    simulation: dict[str, Any] | None = None,
) -> str:
    reviews = persona_report.get("persona_reviews") or []
    synthesis = persona_report.get("comparative_synthesis") or {}

    # Comparison table rows
    compare_rows = []
    for r in reviews:
        dims = r.get("dimension_scores") or {}
        fs = r.get("feature_scores") or {}
        compare_rows.append(
            f"""<tr>
              <td><strong>{_esc(r.get('persona_label'))}</strong><br/><small>{_esc(r.get('persona_type'))}</small></td>
              <td>{r.get('goal_satisfaction', '—')}</td>
              <td>{dims.get('goal_fit', '—')}</td>
              <td>{dims.get('usability', '—')}</td>
              <td>{dims.get('pedagogy', '—')}</td>
              <td>{dims.get('efficiency', '—')}</td>
              <td>{dims.get('trust', '—')}</td>
              <td>{fs.get('chat_tutor', '—')}</td>
              <td>{fs.get('practice_mode', '—')}</td>
            </tr>"""
        )

    # Per-persona cards
    persona_cards = []
    for r in reviews:
        improvements = r.get("improvements") or []
        imp_html = "".join(
            f"""<li><span class="pri-{ _esc(i.get('priority','P2').lower()) }">{_esc(i.get('priority'))}</span>
                <strong>{_esc(i.get('area'))}</strong>: {_esc(i.get('suggestion'))}
                <em>({_esc(i.get('rationale'))})</em></li>"""
            for i in improvements
        )
        worked = "".join(f"<li>{_esc(x)}</li>" for x in r.get("what_worked") or [])
        failed = "".join(f"<li>{_esc(x)}</li>" for x in r.get("what_failed") or [])
        persona_cards.append(
            f"""<div class="persona-card">
              <h3>{_esc(r.get('persona_label'))} <span class="badge">{_esc(r.get('persona_type'))}</span></h3>
              <p class="goal-sat">Goal satisfaction: <strong>{r.get('goal_satisfaction', '—')}/10</strong></p>
              <p class="dialectic">{_esc(r.get('dialectical_analysis'))}</p>
              <div class="cols">
                <div><h4>✓ 有效之处</h4><ul>{worked or '<li>—</li>'}</ul></div>
                <div><h4>✗ 不足之处</h4><ul>{failed or '<li>—</li>'}</ul></div>
              </div>
              <h4>改进建议</h4><ul class="improvements">{imp_html or '<li>—</li>'}</ul>
            </div>"""
        )

    # Synthesis sections
    rankings = synthesis.get("persona_rankings") or []
    rank_rows = "".join(
        f"<tr><td>{_esc(x.get('persona_label'))}</td><td>{x.get('goal_satisfaction','—')}</td>"
        f"<td>{x.get('overall_fit','—')}</td><td>{_esc(x.get('one_line_verdict'))}</td></tr>"
        for x in rankings
    )

    conflicts = synthesis.get("cross_persona_conflicts") or []
    conflict_blocks = "".join(
        f"""<div class="conflict"><strong>{_esc(c.get('topic'))}</strong>
          <p>{_esc(c.get('persona_a'))} vs {_esc(c.get('persona_b'))}: {_esc(c.get('tension'))}</p></div>"""
        for c in conflicts
    )

    consensus = synthesis.get("consensus_improvements") or []
    consensus_items = "".join(
        f"""<li><span class="pri-{_esc(c.get('priority','P2').lower())}">{_esc(c.get('priority'))}</span>
            <strong>{_esc(c.get('area'))}</strong>: {_esc(c.get('suggestion'))}
            <small>支持: {', '.join(_esc(p) for p in c.get('supported_by') or [])}</small></li>"""
        for c in consensus
    )

    student_prio = synthesis.get("student_only_priorities") or []
    student_items = "".join(
        f"""<li><span class="pri-{_esc(s.get('priority','P2').lower())}">{_esc(s.get('priority'))}</span>
            {_esc(s.get('suggestion'))} — <em>{_esc(s.get('rationale'))}</em></li>"""
        for s in student_prio
    )

    heatmap = synthesis.get("feature_heatmap") or {}
    heat_rows = ""
    for feat in ("learning_mode", "practice_mode", "chat_tutor", "grades_tracker", "autograder", "onboarding"):
        h = heatmap.get(feat) or {}
        avg = h.get("avg") if h.get("avg") is not None else _avg_feature(reviews, feat)
        heat_rows += (
            f"<tr><td>{feat}</td><td>{avg if avg is not None else '—'}</td>"
            f"<td>{_esc(h.get('strongest_persona', '—'))}</td>"
            f"<td>{_esc(h.get('weakest_persona', '—'))}</td></tr>"
        )

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <title>AI Tutor — 多 Persona 产品对比报告</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 2rem; max-width: 1200px; color: #1a1a1a; line-height: 1.55; }}
    h1 {{ border-bottom: 2px solid #0969da; padding-bottom: 0.5rem; }}
    h2 {{ margin-top: 2rem; color: #0969da; }}
    table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }}
    th, td {{ border: 1px solid #d0d7de; padding: 0.5rem 0.75rem; text-align: left; }}
    th {{ background: #f6f8fa; }}
    .persona-card {{ border: 1px solid #d0d7de; border-radius: 8px; padding: 1.25rem; margin: 1rem 0; }}
    .persona-card h3 {{ margin-top: 0; }}
    .badge {{ font-size: 0.75rem; background: #ddf4ff; padding: 0.15rem 0.5rem; border-radius: 4px; }}
    .cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }}
    .dialectic {{ background: #fff8c5; padding: 0.75rem; border-radius: 6px; font-style: italic; }}
    .conflict {{ background: #fff1e5; padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; }}
    .executive {{ background: #dafbe1; padding: 1rem; border-radius: 8px; font-size: 1.05rem; }}
    .pri-p0 {{ background: #ffebe9; color: #cf222e; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; }}
    .pri-p1 {{ background: #fff8c5; color: #9a6700; padding: 0.1rem 0.4rem; border-radius: 4px; }}
    .pri-p2 {{ background: #eaeef2; color: #57606a; padding: 0.1rem 0.4rem; border-radius: 4px; }}
    ul {{ padding-left: 1.25rem; }}
    .improvements li {{ margin-bottom: 0.5rem; }}
  </style>
</head>
<body>
  <h1>AI Tutor — 多 Persona 产品辩证评测对比报告</h1>
  <p>Generated: {_esc(persona_report.get('generated_at'))} · {len(reviews)} personas</p>

  <section class="executive">
    <h2 style="margin-top:0;border:none;color:inherit;">Executive Summary</h2>
    <p>{_esc(synthesis.get('executive_summary'))}</p>
  </section>

  <h2>Persona 对比矩阵</h2>
  <table>
    <thead><tr>
      <th>Persona</th><th>Goal Sat.</th><th>目标匹配</th><th>易用性</th><th>教学价值</th>
      <th>效率</th><th>信任</th><th>Chat</th><th>Practice</th>
    </tr></thead>
    <tbody>{''.join(compare_rows)}</tbody>
  </table>

  <h2>功能热力图（跨 Persona）</h2>
  <table>
    <thead><tr><th>功能模块</th><th>平均分</th><th>最满意 Persona</th><th>最不满 Persona</th></tr></thead>
    <tbody>{heat_rows}</tbody>
  </table>

  <h2>综合排名</h2>
  <table>
    <thead><tr><th>Persona</th><th>Goal Sat.</th><th>Overall Fit</th><th>一句话评价</th></tr></thead>
    <tbody>{rank_rows or '<tr><td colspan="4">—</td></tr>'}</tbody>
  </table>

  <h2>跨 Persona 矛盾（设计取舍）</h2>
  {conflict_blocks or '<p>无明显矛盾。</p>'}

  <h2>共识改进项（多人共同提出）</h2>
  <ul>{consensus_items or '<li>—</li>'}</ul>

  <h2>学生优先改进路线图</h2>
  <ul>{student_items or '<li>—</li>'}</ul>

  <h2>各 Persona 详细评测</h2>
  {''.join(persona_cards)}
</body>
</html>"""


def write_persona_report_artifacts(
    *,
    persona_report: dict[str, Any],
    simulation: dict[str, Any],
    evaluation: dict[str, Any],
    output_dir: Path,
) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, str] = {}

    json_path = output_dir / "persona_reviews.json"
    json_path.write_text(json.dumps(persona_report, indent=2, ensure_ascii=False), encoding="utf-8")
    paths["persona_reviews"] = str(json_path)

    html_path = output_dir / "comparative_report.html"
    html_path.write_text(
        generate_comparative_html(persona_report=persona_report, simulation=simulation),
        encoding="utf-8",
    )
    paths["comparative_report"] = str(html_path)

    return paths
