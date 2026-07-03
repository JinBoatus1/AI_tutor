"""Standing + goal-seek ladder, computed server-side from a rich wire course.

Pure glue between grades_serde (wire -> compute) and grades_math (compute). No HTTP, no
IO, no persistence -> fully unit-testable. The API route is a thin auth + error-mapping
wrapper around `standing_and_ladder`.

Why a batched ladder (eng-review D7 / outside voice #2): the Grades UI recomputes the WHOLE
letter ladder ("what do I need for an A / A- / B+ …") live on every keystroke. A per-letter
endpoint would be N round-trips per edit. So one call returns standing + every letter's
needed-score for ONE unknown item.

Status names are translated to the frontend's vocabulary here (presentation, not math, so it
stays out of grades_math):
    grades_math   ->  wire
    ok            ->  ok          (needed = score on the item's own max scale)
    already_met   ->  locked      (needed = 0; you already have this letter locked in)
    infeasible    ->  unreachable (needed = None; even 100% can't reach it)
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import grades_math as gm
import grades_serde as gs

_STATUS_MAP = {"ok": "ok", "already_met": "locked", "infeasible": "unreachable"}


class UnknownItemNotFound(gs.SerdeError):
    """The unknownItemId does not match any item in the course (client-side bug)."""


def standing_and_ladder(
    course_wire: Dict[str, Any], unknown_item_id: Optional[str] = None
) -> Dict[str, Any]:
    """Return {standing:{percent,letter}, ladder:[{letter,status,needed}] | None}.

    Raises grades_serde.SerdeError (incl. UnknownItemNotFound) on malformed input; the route
    maps that to HTTP 400. Never raises for a normal "can't reach that grade" — that is a
    per-letter `unreachable` entry, not an error.
    """
    projected = gs.course_from_wire(course_wire)  # nulls stripped, ids/term dropped
    standing = gm.compute_standing(projected)
    payload: Dict[str, Any] = {
        "standing": {"percent": standing.percent, "letter": standing.letter},
        "ladder": None,
    }
    if not unknown_item_id:
        return payload

    found = gs.find_wire_item(course_wire, unknown_item_id)
    if found is None:
        raise UnknownItemNotFound(f"unknownItemId {unknown_item_id!r} not found in course")
    cat_name, max_score, weight, is_replacer = found

    ladder = []
    for c in sorted(projected.cutoffs, key=lambda c: c.min_pct, reverse=True):
        try:
            res = gm.goal_seek(projected, c.letter, cat_name, max_score,
                               unknown_weight=weight, unknown_is_replacer=is_replacer)
        except ValueError:
            # Defensive: c.letter always has a cutoff and cat_name exists, so this
            # shouldn't fire — but never let a math edge case 500 the endpoint.
            ladder.append({"letter": c.letter, "status": "unreachable", "needed": None})
            continue
        status = _STATUS_MAP.get(res.status, "unreachable")
        needed = res.needed_score if status == "ok" else (0.0 if status == "locked" else None)
        ladder.append({"letter": c.letter, "status": status, "needed": needed})

    payload["ladder"] = ladder
    return payload


def build_standing_prompt(course_wire: Dict[str, Any]) -> str:
    """A compact one-line grade-standing fragment for the tutor's system prompt.

    Returns "" when nothing is graded yet (no useful standing to inject). Raises
    grades_serde.SerdeError on a malformed doc — the /api/chat caller wraps this in
    try/except (D8) so a bad stored course never breaks chat. Deliberately terse and
    "do not volunteer" so the tutor only uses it when the student asks about grades.
    """
    projected = gs.course_from_wire(course_wire)
    standing = gm.compute_standing(projected)
    if standing.percent is None:
        return ""
    name = ""
    if isinstance(course_wire, dict) and isinstance(course_wire.get("name"), str):
        name = course_wire["name"].strip()
    label = name or "their course"
    letter = f" ({standing.letter})" if standing.letter else ""
    return (
        f"\n\nThe student's current grade in {label} is "
        f"{standing.percent:.1f}%{letter} on graded work so far. "
        "If they ask what score they need on an upcoming assignment or exam to reach a target "
        "grade, use this context and the tracker; do not volunteer their grade unprompted."
    )
