"""Tests for grades_report.standing_and_ladder (pure standing + goal-seek ladder).

Run: pytest test_grades_report.py   (from backend/)
"""

import pytest

import grades_report as gr
import grades_serde as gs


def _course_with_unknown_final():
    """3 graded exams + 1 ungraded Final in a 100-pt RankWeights(7,7,7,4) category-ish.

    Uses Uniform over 4 slots so the arithmetic is easy to reason about:
      category weight 100, 4 slots -> 25 pts each. 3 graded at 90/80/70, Final ungraded.
    """
    return {
        "name": "Discrete Math",
        "term": "Fall 2026",
        "categories": [
            {
                "id": "c1",
                "name": "Exams",
                "weight": 100,
                "rule": {"kind": "uniform", "nSlots": 4},
                "items": [
                    {"id": "e1", "name": "E1", "score": 90, "maxScore": 100},
                    {"id": "e2", "name": "E2", "score": 80, "maxScore": 100},
                    {"id": "e3", "name": "E3", "score": 70, "maxScore": 100},
                    {"id": "final", "name": "Final", "score": None, "maxScore": 100},
                ],
            }
        ],
        "cutoffs": [
            {"letter": "A", "min": 90},
            {"letter": "B", "min": 80},
            {"letter": "C", "min": 70},
        ],
    }


# --------------------------------------------------------------------------- #
# Standing only (no unknown item)
# --------------------------------------------------------------------------- #
def test_standing_only_no_ladder():
    out = gr.standing_and_ladder(_course_with_unknown_final())
    assert out["ladder"] is None
    # graded-only renormalized standing = mean of 90/80/70 = 80 (Final stripped)
    assert out["standing"]["percent"] == pytest.approx(80.0)
    assert out["standing"]["letter"] == "B"


def test_standing_null_final_not_counted_as_zero():
    out = gr.standing_and_ladder(_course_with_unknown_final())
    assert out["standing"]["percent"] > 75  # would be ~60 if Final counted as 0


# --------------------------------------------------------------------------- #
# Ladder for the unknown Final
# --------------------------------------------------------------------------- #
def test_ladder_has_entry_per_cutoff_letter():
    out = gr.standing_and_ladder(_course_with_unknown_final(), "final")
    letters = [row["letter"] for row in out["ladder"]]
    assert letters == ["A", "B", "C"]  # sorted by min_pct desc


def test_ladder_statuses_and_needed():
    out = gr.standing_and_ladder(_course_with_unknown_final(), "final")
    by_letter = {row["letter"]: row for row in out["ladder"]}
    # Final is the 4th 25-pt slot. Course total = (90+80+70+finalPct)/4.
    # For A (>=90): need (240 + f)/4 >= 90 -> f >= 120 -> impossible -> unreachable
    assert by_letter["A"]["status"] == "unreachable"
    assert by_letter["A"]["needed"] is None
    # For B (>=80): need 240 + f >= 320 -> f >= 80 -> ok, needed 80 on a 100 max
    assert by_letter["B"]["status"] == "ok"
    assert by_letter["B"]["needed"] == pytest.approx(80.0)
    # For C (>=70): need 240 + f >= 280 -> f >= 40 -> ok, needed 40
    assert by_letter["C"]["status"] == "ok"
    assert by_letter["C"]["needed"] == pytest.approx(40.0)


def test_ladder_locked_when_already_met():
    # A course already sitting well above the C cutoff with an unknown that can only help.
    course = _course_with_unknown_final()
    course["cutoffs"].append({"letter": "D", "min": 10})
    out = gr.standing_and_ladder(course, "final")
    d_row = next(r for r in out["ladder"] if r["letter"] == "D")
    assert d_row["status"] == "locked"
    assert d_row["needed"] == 0.0


# --------------------------------------------------------------------------- #
# Errors -> SerdeError (route maps to 400)
# --------------------------------------------------------------------------- #
def test_unknown_item_id_not_found_raises():
    with pytest.raises(gr.UnknownItemNotFound):
        gr.standing_and_ladder(_course_with_unknown_final(), "does-not-exist")


def test_unknown_item_error_is_serde_subclass():
    # so the route's `except SerdeError` catches it -> 400
    assert issubclass(gr.UnknownItemNotFound, gs.SerdeError)


def test_malformed_course_raises_serde():
    with pytest.raises(gs.SerdeError):
        gr.standing_and_ladder({"name": "X", "categories": {}, "cutoffs": []})


# --------------------------------------------------------------------------- #
# build_standing_prompt (the /api/chat injection fragment)
# --------------------------------------------------------------------------- #
def test_standing_prompt_contains_grade_and_name():
    frag = gr.build_standing_prompt(_course_with_unknown_final())
    assert "Discrete Math" in frag
    assert "80.0%" in frag
    assert "(B)" in frag


def test_standing_prompt_empty_when_nothing_graded():
    course = _course_with_unknown_final()
    for it in course["categories"][0]["items"]:
        it["score"] = None  # nothing graded
    assert gr.build_standing_prompt(course) == ""


def test_standing_prompt_raises_on_malformed():
    with pytest.raises(gs.SerdeError):
        gr.build_standing_prompt({"name": "X", "categories": {}, "cutoffs": []})
