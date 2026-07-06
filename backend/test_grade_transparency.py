"""Result-transparency helpers ("b"): per-category breakdown, winning scheme, replace boost.

Run: pytest test_grade_transparency.py   (from backend/)

Pure grades_math + grades_report — no HTTP, no IO. Fixtures use sum-to-100 courses per the
standing convention (earned points == percent). See 2026-07-06-grade-transparency-design.md.
"""

import grades_math as gm
import grades_report as gr

CUTOFFS = [gm.Cutoff("A", 93), gm.Cutoff("A-", 90), gm.Cutoff("B", 80), gm.Cutoff("F", 0)]


# --------------------------------------------------------------------------- #
# category_breakdown
# --------------------------------------------------------------------------- #
def _two_cat_course(weightings=None):
    # Exams: 45/50 -> 90%.  Essays: ungraded.
    exams = gm.Category("Exams", 50, gm.Uniform(2), [gm.Item("M1", 88, 100), gm.Item("M2", 92, 100)])
    essays = gm.Category("Essays", 50, gm.Uniform(2), [])
    return gm.Course("t", [exams, essays], CUTOFFS, weightings or [])


def test_category_breakdown_percents_and_alignment():
    rows = gm.category_breakdown(_two_cat_course())
    assert [r.name for r in rows] == ["Exams", "Essays"]  # index-aligned, one per category
    assert rows[0].percent == 90.0 and rows[0].graded is True and rows[0].weight == 50
    assert rows[1].percent is None and rows[1].graded is False


def test_category_breakdown_is_scheme_invariant():
    base = _two_cat_course()
    reweighted = gm.apply_scheme(base, [60, 40])  # Exams 50 -> 60
    assert gm.category_breakdown(reweighted)[0].percent == gm.category_breakdown(base)[0].percent == 90.0


# --------------------------------------------------------------------------- #
# winning_scheme
# --------------------------------------------------------------------------- #
def _weighting_course(schemes):
    # Midterm 70%, Final 100%. Primary 60/40 -> 82%. [40,60] -> 88%.
    mid = gm.Category("Midterm", 60, gm.Uniform(1), [gm.Item("m", 70, 100)])
    fin = gm.Category("Final", 40, gm.Uniform(1), [gm.Item("f", 100, 100)])
    return gm.Course("t", [mid, fin], CUTOFFS, schemes)


def test_winning_scheme_none_without_weightings():
    assert gm.winning_scheme(_weighting_course([])) is None


def test_winning_scheme_alternate_wins():
    c = _weighting_course([gm.WeightScheme("Final-heavy", [40, 60])])
    assert gm.winning_scheme(c) == ("Final-heavy", 2)


def test_winning_scheme_primary_wins_when_better():
    c = _weighting_course([gm.WeightScheme("Bad", [70, 30])])  # -> 79% < primary 82%
    assert gm.winning_scheme(c) == (gm.PRIMARY_SCHEME, 2)


def test_winning_scheme_ties_keep_primary():
    c = _weighting_course([gm.WeightScheme("Same", [60, 40])])  # identical to primary -> tie
    assert gm.winning_scheme(c) == (gm.PRIMARY_SCHEME, 2)


# --------------------------------------------------------------------------- #
# replace_boosts
# --------------------------------------------------------------------------- #
def _replace_course(final_frac):
    # Tests(30): M1 .8/w10, M2 .6/w10, Final <final>/w10 replacer.  Other(70): 100%.
    tests = gm.Category("Tests", 30, gm.ReplaceLowest(), [
        gm.Item("M1", 80, 100, weight=10),
        gm.Item("M2", 60, 100, weight=10),
        gm.Item("Final", final_frac * 100, 100, weight=10, replacer=True),
    ])
    other = gm.Category("Other", 70, gm.Uniform(1), [gm.Item("o", 100, 100)])
    return gm.Course("t", [tests, other], CUTOFFS)


def test_replace_boost_fires():
    boosts = gm.replace_boosts(_replace_course(0.9))  # Final .9 > lowest M2 .6
    assert len(boosts) == 1
    b = boosts[0]
    assert b.category_name == "Tests" and b.replacer == "Final" and b.lifted == "M2"
    # boost_points = 10 * (0.9 - 0.6) = 3.0 ; total_graded_weight = 30 + 70 = 100 -> +3.0%
    assert round(b.delta_pct, 2) == 3.0


def test_replace_boost_does_not_fire_when_replacer_not_higher():
    assert gm.replace_boosts(_replace_course(0.5)) == []  # Final .5 <= lowest .6


def test_replace_boost_empty_without_replace_rule():
    assert gm.replace_boosts(_two_cat_course()) == []


# --------------------------------------------------------------------------- #
# grades_report wiring (breakdown block on the standing response)
# --------------------------------------------------------------------------- #
def _wire(course_dict_extra=None):
    # Minimal rich wire course: Exams(50) uniform 2 items graded, Essays(50) ungraded.
    return {
        "name": "t", "term": "",
        "categories": [
            {"id": "c1", "name": "Exams", "weight": 50, "rule": {"kind": "uniform", "nSlots": 2},
             "items": [{"id": "i1", "name": "M1", "score": 88, "maxScore": 100},
                       {"id": "i2", "name": "M2", "score": 92, "maxScore": 100}]},
            {"id": "c2", "name": "Essays", "weight": 50, "rule": {"kind": "uniform", "nSlots": 2},
             "items": [{"id": "i3", "name": "E1", "score": None, "maxScore": 100}]},
        ],
        "cutoffs": [{"letter": "A", "min": 93}, {"letter": "A-", "min": 90}, {"letter": "F", "min": 0}],
    }


def test_standing_response_includes_breakdown():
    resp = gr.standing_and_ladder(_wire())
    assert "breakdown" in resp
    bd = resp["breakdown"]
    assert [c["name"] for c in bd["categories"]] == ["Exams", "Essays"]
    assert bd["categories"][0]["percent"] == 90.0 and bd["categories"][0]["graded"] is True
    assert bd["categories"][1]["percent"] is None and bd["categories"][1]["graded"] is False
    assert bd["winningScheme"] is None  # no alternates
    assert bd["replaceBoosts"] == []


def test_standing_response_standing_unchanged():
    resp = gr.standing_and_ladder(_wire())
    assert resp["standing"]["percent"] == 90.0 and resp["standing"]["letter"] == "A-"
