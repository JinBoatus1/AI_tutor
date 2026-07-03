"""Tests for the FixedWeights rule (positional per-item weights).

Run: pytest test_grades_fixedweights.py   (from backend/)

The existing test_grades_math.py is the REGRESSION baseline for the rank-based path —
it must stay green (that proves FixedWeights didn't disturb RankWeights/Uniform/DropLowest).
"""

import pytest

import grades_math as gm


def _cutoffs():
    return [gm.Cutoff("A", 90), gm.Cutoff("B", 80), gm.Cutoff("C", 70), gm.Cutoff("D", 40)]


# --------------------------------------------------------------------------- #
# The whole reason FixedWeights exists: fixed != rank on the SAME weights.
# Low-weight item is the HIGH scorer -> rank would reward it, fixed does not.
# --------------------------------------------------------------------------- #
def test_fixed_vs_rank_diverge_same_weights():
    # Two tests, category weight 50: Test1 weight 10 scored 100%, Test2 weight 40 scored 50%.
    items = lambda: [  # noqa: E731
        gm.Item("Test1", 100, 100, weight=10),
        gm.Item("Test2", 50, 100, weight=40),
    ]
    fixed = gm.Course("F", [gm.Category("Exams", 50, gm.FixedWeights(), items())], _cutoffs())
    rank = gm.Course("R", [gm.Category("Exams", 50, gm.RankWeights((10, 40)), items())], _cutoffs())

    # Fixed: 10*1.0 + 40*0.5 = 30 earned over graded_weight 50 -> 60%
    assert gm.compute_standing(fixed).percent == pytest.approx(60.0)
    # Rank: sorts -> 40*1.0 (best) + 10*0.5 = 45 over 50 -> 90%
    assert gm.compute_standing(rank).percent == pytest.approx(90.0)


def test_fixed_standing_renormalizes_over_graded_only():
    # Category weight 100, tests 20/30/50; only Test1 graded (100%) -> renormalize over 20.
    course = gm.Course(
        "F",
        [gm.Category("Exams", 100, gm.FixedWeights(), [gm.Item("T1", 100, 100, weight=20)])],
        _cutoffs(),
    )
    s = gm.compute_standing(course)
    assert s.percent == pytest.approx(100.0)  # 20/20, not 20/100
    assert s.graded_weight == pytest.approx(20.0)


# --------------------------------------------------------------------------- #
# goal_seek: linear, uses the unknown item's OWN weight.
# --------------------------------------------------------------------------- #
def _course_for_goal():
    # One category weight 100, tests 20/30/50. Test1 & Test2 graded 100%; Test3 (w50) is the unknown.
    return gm.Course(
        "F",
        [gm.Category("Exams", 100, gm.FixedWeights(),
                     [gm.Item("T1", 100, 100, weight=20), gm.Item("T2", 100, 100, weight=30)])],
        _cutoffs(),
    )


def test_fixed_goal_seek_linear():
    # base = 20 + 30 = 50; w_u = 50. For A(90): x* = (90-50)/50 = 0.8 -> 80 on a 100 max.
    res = gm.goal_seek(_course_for_goal(), "A", "Exams", unknown_max_score=100, unknown_weight=50)
    assert res.status == "ok"
    assert res.needed_score == pytest.approx(80.0)
    assert res.needed_fraction == pytest.approx(0.8)


def test_fixed_goal_seek_already_met():
    # D(40): base 50 >= 40 -> already locked in, needs 0.
    res = gm.goal_seek(_course_for_goal(), "D", "Exams", unknown_max_score=100, unknown_weight=50)
    assert res.status == "already_met"
    assert res.needed_score == 0.0


def test_fixed_goal_seek_infeasible_when_weight_too_small():
    # base 50, w_u 5 -> max reachable 55 < A(90) -> infeasible.
    res = gm.goal_seek(_course_for_goal(), "A", "Exams", unknown_max_score=100, unknown_weight=5)
    assert res.status == "infeasible"
    assert res.needed_score is None


def test_fixed_goal_seek_requires_unknown_weight():
    with pytest.raises(ValueError, match="unknown_weight"):
        gm.goal_seek(_course_for_goal(), "A", "Exams", unknown_max_score=100)  # no weight


# --------------------------------------------------------------------------- #
# validate_rubric: item weights should sum to the category weight.
# --------------------------------------------------------------------------- #
def test_validate_warns_when_item_weights_miss_category_weight():
    course = gm.Course(
        "F",
        [gm.Category("Exams", 50, gm.FixedWeights(),
                     [gm.Item("T1", 90, 100, weight=10), gm.Item("T2", 80, 100, weight=15)])],  # 25 != 50
        _cutoffs(),
    )
    warns = gm.validate_rubric(course)
    assert any("item weights sum to 25" in w for w in warns)


def test_validate_clean_when_item_weights_match():
    course = gm.Course(
        "F",
        [gm.Category("Exams", 100, gm.FixedWeights(),
                     [gm.Item("T1", 90, 100, weight=40), gm.Item("T2", 80, 100, weight=60)])],
        _cutoffs(),
    )
    warns = gm.validate_rubric(course)
    assert not any("item weights sum" in w for w in warns)
