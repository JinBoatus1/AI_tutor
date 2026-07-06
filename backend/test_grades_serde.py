"""Tests for grades_serde: rich wire JSON -> grades_math compute dataclasses.

Run: pytest test_grades_serde.py   (from backend/)
"""

import math

import pytest

import grades_math as gm
import grades_serde as gs


# --------------------------------------------------------------------------- #
# Rule round-trips (wire kind -> correct dataclass)
# --------------------------------------------------------------------------- #
def test_rule_uniform():
    r = gs.rule_from_wire({"kind": "uniform", "nSlots": 3})
    assert r == gm.Uniform(n_slots=3)


def test_rule_drop_lowest():
    r = gs.rule_from_wire({"kind": "dropLowest", "nSlots": 4, "k": 1})
    assert r == gm.DropLowest(n_slots=4, k=1)


def test_rule_rank_weights_list_becomes_tuple():
    r = gs.rule_from_wire({"kind": "rankWeights", "weights": [7, 7, 7, 4]})
    assert r == gm.RankWeights(slot_weights=(7.0, 7.0, 7.0, 4.0))
    assert isinstance(r.slot_weights, tuple)


def test_rule_unknown_kind_raises():
    with pytest.raises(gs.SerdeError, match="unknown rule kind"):
        gs.rule_from_wire({"kind": "bogus", "nSlots": 2})


def test_rule_missing_field_raises():
    with pytest.raises(gs.SerdeError, match="nSlots"):
        gs.rule_from_wire({"kind": "uniform"})


def test_rule_bool_nslots_rejected():
    # bool is an int subclass; must not sneak through as 1/0
    with pytest.raises(gs.SerdeError):
        gs.rule_from_wire({"kind": "uniform", "nSlots": True})


# --------------------------------------------------------------------------- #
# Item: null-score is stripped (THE load-bearing invariant, D6)
# --------------------------------------------------------------------------- #
def test_item_null_score_returns_none():
    assert gs.item_from_wire({"id": "x", "name": "Final", "score": None, "maxScore": 100}) is None


def test_item_graded_projects():
    it = gs.item_from_wire({"id": "x", "name": "Exam 1", "score": 88, "maxScore": 100})
    assert it == gm.Item(name="Exam 1", score=88.0, max_score=100.0)


def test_item_drops_id():
    it = gs.item_from_wire({"id": "keep-me?", "name": "Q", "score": 5, "maxScore": 10})
    assert not hasattr(it, "id")


def test_item_string_score_raises():
    with pytest.raises(gs.SerdeError, match="score"):
        gs.item_from_wire({"id": "x", "name": "Q", "score": "90", "maxScore": 100})


# --------------------------------------------------------------------------- #
# Category strips null items
# --------------------------------------------------------------------------- #
def test_category_strips_null_items():
    cat = gs.category_from_wire(
        {
            "id": "c1",
            "name": "Exams",
            "weight": 25,
            "rule": {"kind": "rankWeights", "weights": [7, 7, 7, 4]},
            "items": [
                {"id": "e1", "name": "E1", "score": 90, "maxScore": 100},
                {"id": "e2", "name": "E2", "score": None, "maxScore": 100},  # ungraded -> stripped
                {"id": "e3", "name": "E3", "score": 80, "maxScore": 100},
            ],
        }
    )
    assert cat.name == "Exams"
    assert cat.weight == 25.0
    assert [it.name for it in cat.items] == ["E1", "E3"]  # E2 stripped


# --------------------------------------------------------------------------- #
# Course: drops term, projects whole tree
# --------------------------------------------------------------------------- #
def _wire_course():
    return {
        "name": "Discrete Math",
        "term": "Fall 2026",
        "categories": [
            {
                "id": "c1",
                "name": "Exams",
                "weight": 100,
                "rule": {"kind": "rankWeights", "weights": [7, 7, 7, 4]},
                "items": [
                    {"id": "e1", "name": "E1", "score": 90, "maxScore": 100},
                    {"id": "e2", "name": "E2", "score": 80, "maxScore": 100},
                    {"id": "e3", "name": "E3", "score": 70, "maxScore": 100},
                    {"id": "e4", "name": "Final", "score": None, "maxScore": 100},  # not taken
                ],
            }
        ],
        "cutoffs": [
            {"letter": "A", "min": 90},
            {"letter": "B", "min": 80},
            {"letter": "C", "min": 70},
        ],
    }


def test_course_drops_term_and_maps_cutoffs():
    course = gs.course_from_wire(_wire_course())
    assert course.name == "Discrete Math"
    assert not hasattr(course, "term")
    assert course.cutoffs[0] == gm.Cutoff(letter="A", min_pct=90.0)


def test_projection_feeds_compute_standing_null_not_zero():
    """The motivating case: an ungraded Final must NOT drag standing to ~0."""
    course = gs.course_from_wire(_wire_course())
    standing = gm.compute_standing(course)
    # 3 graded exams (90/80/70) on a RankWeights(7,7,7,4); Final stripped, so it
    # renormalizes over graded weight. Standing should be a healthy ~80, not tanked.
    assert standing.percent is not None
    assert 78.0 < standing.percent < 82.0  # NOT near 0


def test_projection_feeds_goal_seek():
    """After stripping the null Final, goal_seek appends it as the fresh unknown slot."""
    course = gs.course_from_wire(_wire_course())
    res = gm.goal_seek(course, target_letter="A", unknown_category="Exams", unknown_max_score=100.0)
    assert res.status in {"ok", "already_met", "infeasible"}


# --------------------------------------------------------------------------- #
# find_wire_item (for the goal-seek route)
# --------------------------------------------------------------------------- #
def test_find_wire_item_returns_category_and_max():
    got = gs.find_wire_item(_wire_course(), "e4")
    assert got == ("Exams", 100.0, None, False)  # no per-item weight, not a replacer


def test_find_wire_item_missing_returns_none():
    assert gs.find_wire_item(_wire_course(), "nope") is None


# --------------------------------------------------------------------------- #
# Malformed top-level input
# --------------------------------------------------------------------------- #
def test_course_not_object_raises():
    with pytest.raises(gs.SerdeError, match="must be an object"):
        gs.course_from_wire([1, 2, 3])


def test_course_categories_not_list_raises():
    with pytest.raises(gs.SerdeError, match="categories"):
        gs.course_from_wire({"name": "X", "categories": {}, "cutoffs": []})


def test_empty_course_is_valid():
    course = gs.course_from_wire({"name": "Empty", "categories": [], "cutoffs": []})
    assert gm.compute_standing(course).percent is None  # nothing graded


# --------------------------------------------------------------------------- #
# FixedWeights rule + per-item weight (model B)
# --------------------------------------------------------------------------- #
def test_rule_fixed_weights():
    r = gs.rule_from_wire({"kind": "fixedWeights"})
    assert isinstance(r, gm.FixedWeights)


def test_item_weight_parsed():
    it = gs.item_from_wire({"id": "t1", "name": "Test 1", "score": 90, "maxScore": 100, "weight": 10})
    assert it.weight == 10.0


def test_item_weight_optional_defaults_none():
    it = gs.item_from_wire({"id": "q", "name": "Q", "score": 5, "maxScore": 10})
    assert it.weight is None


def _fixed_wire():
    return {
        "name": "Logic",
        "term": "Spring 2026",
        "categories": [{
            "id": "c1", "name": "Tests", "weight": 50,
            "rule": {"kind": "fixedWeights"},
            "items": [
                {"id": "t1", "name": "Test 1", "score": 100, "maxScore": 100, "weight": 10},
                {"id": "t2", "name": "Test 2", "score": None, "maxScore": 100, "weight": 15},  # ungraded
                {"id": "t3", "name": "Test 3", "score": 80, "maxScore": 100, "weight": 25},
            ],
        }],
        "cutoffs": [{"letter": "A", "min": 90}],
    }


def test_fixed_course_projects_and_strips_null_keeping_weights():
    course = gs.course_from_wire(_fixed_wire())
    cat = course.categories[0]
    assert isinstance(cat.rule, gm.FixedWeights)
    # Test 2 (null score) stripped; graded items keep their weights
    assert [it.name for it in cat.items] == ["Test 1", "Test 3"]
    assert [it.weight for it in cat.items] == [10.0, 25.0]


def test_find_wire_item_returns_weight_for_goal_seek():
    got = gs.find_wire_item(_fixed_wire(), "t2")  # the ungraded Test 2
    assert got == ("Tests", 100.0, 15.0, False)  # (category, max_score, weight, replacer)


# --------------------------------------------------------------------------- #
# ReplaceLowest rule + replacer flag (T3)
# --------------------------------------------------------------------------- #
def test_rule_from_wire_replace_lowest():
    import grades_serde as gs, grades_math as gm
    assert gs.rule_from_wire({"kind": "replaceLowest"}) == gm.ReplaceLowest()


def test_item_from_wire_carries_replacer_flag():
    import grades_serde as gs
    it = gs.item_from_wire({"name": "Final", "score": 90, "maxScore": 100, "weight": 10, "replacer": True})
    assert it is not None and it.replacer is True and it.weight == 10.0


def test_find_wire_item_returns_replacer_flag():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "ex", "name": "Exams", "weight": 30, "rule": {"kind": "replaceLowest"}, "items": [
            {"id": "m1", "name": "M1", "score": 80, "maxScore": 100, "weight": 10},
            {"id": "fin", "name": "Final", "score": None, "maxScore": 100, "weight": 10, "replacer": True},
        ]}], "cutoffs": [{"letter": "A", "min": 90}]}
    found = gs.find_wire_item(course, "fin")
    assert found == ("Exams", 100.0, 10.0, True)


# --------------------------------------------------------------------------- #
# Task 8: course.weightings parsing (id-keyed -> positional)
# --------------------------------------------------------------------------- #
def test_course_from_wire_parses_weightings_positional():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "mid", "name": "Midterm", "weight": 60, "rule": {"kind": "uniform", "nSlots": 1},
         "items": [{"id": "m", "name": "M", "score": 50, "maxScore": 100}]},
        {"id": "fin", "name": "Final", "weight": 40, "rule": {"kind": "uniform", "nSlots": 1}, "items": []},
    ], "cutoffs": [{"letter": "A", "min": 90}],
        "weightings": [{"name": "final-heavy", "weights": {"mid": 40, "fin": 60}}]}
    gm_course = gs.course_from_wire(course)
    assert len(gm_course.weightings) == 1
    assert gm_course.weightings[0].name == "final-heavy"
    assert gm_course.weightings[0].weights == [40.0, 60.0]  # positional: [Midterm, Final]


def test_course_from_wire_weightings_missing_category_falls_back_to_primary():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "mid", "name": "Midterm", "weight": 60, "rule": {"kind": "uniform", "nSlots": 1}, "items": []},
        {"id": "fin", "name": "Final", "weight": 40, "rule": {"kind": "uniform", "nSlots": 1}, "items": []},
    ], "cutoffs": [], "weightings": [{"name": "partial", "weights": {"fin": 70}}]}
    gm_course = gs.course_from_wire(course)
    assert gm_course.weightings[0].weights == [60.0, 70.0]  # 'mid' omitted -> primary 60; 'fin' -> 70


def test_course_from_wire_no_weightings_is_empty():
    import grades_serde as gs
    course = {"name": "C", "categories": [
        {"id": "c", "name": "C", "weight": 100, "rule": {"kind": "uniform", "nSlots": 1}, "items": []}],
        "cutoffs": []}
    assert gs.course_from_wire(course).weightings == []


def test_course_from_wire_rejects_malformed_weightings():
    # trust-boundary hardening: non-list weightings and non-object scheme weights must raise, not coerce
    import grades_serde as gs, pytest
    cats = [{"id": "c", "name": "C", "weight": 100, "rule": {"kind": "uniform", "nSlots": 1}, "items": []}]
    with pytest.raises(gs.SerdeError):
        gs.course_from_wire({"name": "C", "categories": cats, "cutoffs": [], "weightings": "nope"})
    with pytest.raises(gs.SerdeError):
        gs.course_from_wire({"name": "C", "categories": cats, "cutoffs": [],
                             "weightings": [{"name": "s", "weights": []}]})
