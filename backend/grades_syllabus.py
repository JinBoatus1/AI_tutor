"""Syllabus PDF -> grading rubric (Course wire shape), via a vision LLM.

Complex syllabi put the grading policy in tables/boxes, so we render pages to images and
let a vision model read them (same pattern as the AutoGrader). This module owns the PROMPT
and the parse/normalize/validate — all pure and unit-testable. The route does the IO
(render PDF, call OpenAI) and hands the raw model text here.

Output is the RICH wire Course (name/term/categories/cutoffs) with categories describing the
RUBRIC only — empty `items` (the student fills scores later in the gradebook). It is validated
against grades_serde so a malformed rule can never reach the frontend.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

import grades_serde as gs

SYSTEM_PROMPT = """You extract a course grading rubric from images of a syllabus.

Return ONLY a JSON object (no prose, no markdown fences) matching EXACTLY this shape:
{
  "name": "<course name, or ''>",
  "term": "<term like 'Fall 2026', or ''>",
  "categories": [
    {"name": "Exams", "weight": <number of points toward a 100-point total>, "rule": <RULE>}
  ],
  "cutoffs": [{"letter": "A", "min": 93}, {"letter": "A-", "min": 90}]
}

RULE is exactly one of:
  {"kind": "uniform", "nSlots": <int>}                  // N equally weighted items
  {"kind": "dropLowest", "nSlots": <int>, "k": <int>}   // drop the k lowest of N, rest equal
  {"kind": "fixedWeights"}                               // items with DISTINCT fixed weights (see below)
  {"kind": "rankWeights", "weights": [<num>, ...]}      // RARE: your BEST scores count more (weights go to the highest scores by rank)

Rules:
- Category `weight` values are POINTS OUT OF 100 and should sum to 100.
- For most categories, describe the rubric ONLY: do NOT invent scores, and leave `items` out.
- A single graded thing (e.g. "Final 30%") is {"kind":"uniform","nSlots":1} with weight 30.
- "N quizzes, drop the lowest M" -> {"kind":"dropLowest","nSlots":N,"k":M}.
- DISTINCT FIXED per-item weights ("three tests weighted 10%, 15%, 25% respectively";
  "midterm 20%, final 30%") -> put them in ONE category with {"kind":"fixedWeights"} and
  INCLUDE its items: give each item a "name" and a "weight" (points out of 100, and NO score).
  The item weights should sum to that category's weight. Pre-name items from the syllabus
  (Test 1, Midterm, Final). Do NOT split these into separate categories, and do NOT use rankWeights.
  Example: {"name":"Tests","weight":50,"rule":{"kind":"fixedWeights"},
            "items":[{"name":"Test 1","weight":10},{"name":"Test 2","weight":15},{"name":"Test 3","weight":25}]}
- Use rankWeights ONLY when the syllabus says your better/higher scores count more (rank-based),
  never for plain fixed per-item weights.
- Infer letter cutoffs from the syllabus grading scale; if none is given, use a standard US
  scale (A 93, A- 90, B+ 87, B 83, B- 80, C+ 77, C 73, C- 70, D 60, F 0).

Return JSON only."""


def build_parse_messages(images_b64: List[str], text: str = "") -> List[Dict[str, Any]]:
    """OpenAI chat messages: system prompt + extracted syllabus text + page images.

    Prose-heavy syllabi scatter the grading breakdown across pages ("three tests
    weighted 10%, 15%, 25%", "40% of the final grade", "the remaining 10%…"). The
    rendered images only cover the first pages and can miss dense text, so we ALSO
    pass the full extracted text — that's usually where the percentages actually live.
    """
    lead = "Extract the grading rubric from this syllabus. Use BOTH the extracted text below and the page images; the grade breakdown is often stated in prose (e.g. 'weighted 10%, 15%, 25%', '40% of the final grade')."
    if text.strip():
        # Syllabi are bounded; the grade breakdown is often on a LATER page, so keep a
        # generous window (front-truncation once dropped the whole grading section).
        lead += "\n\n--- SYLLABUS TEXT ---\n" + text.strip()[:60000] + "\n--- END TEXT ---"
    content: List[Dict[str, Any]] = [{"type": "text", "text": lead}]
    for b64 in images_b64:
        url = b64 if b64.startswith("data:") else f"data:image/png;base64,{b64}"
        content.append({"type": "image_url", "image_url": {"url": url}})
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]


def _loads_lenient(raw: str) -> Any:
    """Parse JSON, tolerating ```json fences or stray prose around the object."""
    s = (raw or "").strip()
    if s.startswith("```"):
        s = s[3:]
        if s[:4].lower() == "json":
            s = s[4:]
        s = s.rsplit("```", 1)[0]
        s = s.strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # Fall back to the outermost {...} span if the model wrapped it in prose.
        i, j = s.find("{"), s.rfind("}")
        if i >= 0 and j > i:
            return json.loads(s[i : j + 1])
        raise


def _num(v: Any, default: float) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        try:
            return float(v)
        except (TypeError, ValueError):
            return default
    return float(v)


def normalize_parsed_course(data: Any) -> Dict[str, Any]:
    """Coerce the model's JSON into a valid rich wire Course.

    Injects category/item ids (the frontend keys on them), defaults term/items, and
    VALIDATES via grades_serde (raises SerdeError on a bad rule). Returns the rich doc.
    """
    if not isinstance(data, dict):
        raise gs.SerdeError("parsed rubric is not a JSON object")

    categories: List[Dict[str, Any]] = []
    for i, c in enumerate(data.get("categories") or []):
        if not isinstance(c, dict):
            raise gs.SerdeError(f"category[{i}] is not an object")
        items: List[Dict[str, Any]] = []
        for j, it in enumerate(c.get("items") or []):
            if not isinstance(it, dict):
                continue
            item_wire: Dict[str, Any] = {
                "id": str(it.get("id") or f"c{i}i{j}"),
                "name": str(it.get("name") or f"Item {j + 1}"),
                "score": it.get("score", None),
                "maxScore": _num(it.get("maxScore"), 100),
            }
            # fixedWeights items carry their OWN fixed weight (points out of 100); preserve
            # it so the positional grade math and the editor sum-check keep working.
            if it.get("weight") is not None:
                item_wire["weight"] = _num(it.get("weight"), 0)
            items.append(item_wire)
        categories.append({
            "id": str(c.get("id") or f"cat{i}"),
            "name": str(c.get("name") or f"Category {i + 1}"),
            "weight": _num(c.get("weight"), 0),
            "rule": c.get("rule"),
            "items": items,
        })

    cutoffs = [
        {"letter": str(x.get("letter", "")), "min": _num(x.get("min"), 0)}
        for x in (data.get("cutoffs") or [])
        if isinstance(x, dict)
    ]

    course = {
        "name": str(data.get("name") or ""),
        "term": str(data.get("term") or ""),
        "categories": categories,
        "cutoffs": cutoffs,
    }

    gs.course_from_wire(course)  # validate rules/shape; raises SerdeError if malformed
    return course
