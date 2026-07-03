"""Tests for grades_syllabus: LLM-JSON -> validated rich wire Course.

Run: pytest test_grades_syllabus.py   (from backend/)
The LLM call itself is not tested here (that's an integration/eval concern); this covers
the pure parse + normalize + validate that turns model output into a safe Course.
"""

import pytest

import grades_serde as gs
import grades_syllabus as syl


def test_build_parse_messages_shape():
    msgs = syl.build_parse_messages(["abc", "data:image/png;base64,zzz"])
    assert msgs[0]["role"] == "system"
    content = msgs[1]["content"]
    assert content[0]["type"] == "text"
    # bare base64 gets a data URL prefix; an existing data URL is passed through
    assert content[1]["image_url"]["url"].startswith("data:image/png;base64,abc")
    assert content[2]["image_url"]["url"] == "data:image/png;base64,zzz"


def test_build_parse_messages_includes_extracted_text():
    # the grade breakdown often lives in prose past the rendered pages, so text must ride along
    msgs = syl.build_parse_messages(["img"], "Tests weighted 10%, 15%, 25%; homework 40%.")
    lead = msgs[1]["content"][0]["text"]
    assert "SYLLABUS TEXT" in lead
    assert "homework 40%" in lead


def test_loads_lenient_plain_json():
    assert syl._loads_lenient('{"name":"X"}') == {"name": "X"}


def test_loads_lenient_strips_code_fence():
    raw = '```json\n{"name":"Y"}\n```'
    assert syl._loads_lenient(raw) == {"name": "Y"}


def test_loads_lenient_extracts_object_from_prose():
    raw = 'Here is the rubric: {"name":"Z","categories":[]} — hope it helps!'
    assert syl._loads_lenient(raw)["name"] == "Z"


def test_normalize_injects_ids_and_defaults():
    data = {
        "name": "Discrete Math",
        "term": "Fall 2026",
        "categories": [
            {"name": "Exams", "weight": 60, "rule": {"kind": "dropLowest", "nSlots": 4, "k": 1}},
            {"name": "Homework", "weight": 40, "rule": {"kind": "uniform", "nSlots": 10}},
        ],
        "cutoffs": [{"letter": "A", "min": 93}, {"letter": "B", "min": 83}],
    }
    course = syl.normalize_parsed_course(data)
    assert course["term"] == "Fall 2026"
    assert [c["id"] for c in course["categories"]] == ["cat0", "cat1"]  # ids injected
    assert all(c["items"] == [] for c in course["categories"])  # rubric only, no scores
    # and it round-trips through the compute projection without error
    gs.course_from_wire(course)


def test_normalize_rejects_bad_rule():
    data = {
        "name": "X",
        "categories": [{"name": "C", "weight": 100, "rule": {"kind": "bogus"}}],
        "cutoffs": [],
    }
    with pytest.raises(gs.SerdeError):
        syl.normalize_parsed_course(data)


def test_normalize_rejects_non_object():
    with pytest.raises(gs.SerdeError):
        syl.normalize_parsed_course([1, 2, 3])


def test_normalize_coerces_string_weights():
    data = {
        "name": "X",
        "categories": [{"name": "C", "weight": "100", "rule": {"kind": "uniform", "nSlots": 1}}],
        "cutoffs": [{"letter": "A", "min": "90"}],
    }
    course = syl.normalize_parsed_course(data)
    assert course["categories"][0]["weight"] == 100.0
    assert course["cutoffs"][0]["min"] == 90.0


def test_normalize_preserves_items_when_present():
    data = {
        "name": "X",
        "categories": [
            {
                "name": "C",
                "weight": 100,
                "rule": {"kind": "uniform", "nSlots": 2},
                "items": [{"name": "Q1", "score": 8, "maxScore": 10}],
            }
        ],
        "cutoffs": [{"letter": "A", "min": 90}],
    }
    course = syl.normalize_parsed_course(data)
    it = course["categories"][0]["items"][0]
    assert it["id"] == "c0i0" and it["name"] == "Q1" and it["maxScore"] == 10.0


def test_normalize_fixedweights_keeps_distinct_item_weights():
    """The logic-syllabus case: 'three tests weighted 10/15/25' becomes ONE fixedWeights
    category with named, per-item-weighted rows (no scores) that round-trips through serde."""
    data = {
        "name": "Intro to Logic",
        "term": "Fall 2026",
        "categories": [
            {
                "name": "Tests",
                "weight": 50,
                "rule": {"kind": "fixedWeights"},
                "items": [
                    {"name": "Test 1", "weight": 10},
                    {"name": "Test 2", "weight": 15},
                    {"name": "Test 3", "weight": 25},
                ],
            },
            {"name": "Homework", "weight": 40, "rule": {"kind": "uniform", "nSlots": 10}},
            {"name": "Live logic", "weight": 10, "rule": {"kind": "uniform", "nSlots": 1}},
        ],
        "cutoffs": [{"letter": "A", "min": 93}],
    }
    course = syl.normalize_parsed_course(data)
    tests = course["categories"][0]
    assert tests["rule"] == {"kind": "fixedWeights"}
    assert [it["name"] for it in tests["items"]] == ["Test 1", "Test 2", "Test 3"]
    assert [it["weight"] for it in tests["items"]] == [10.0, 15.0, 25.0]
    assert all(it["score"] is None for it in tests["items"])  # rubric only, no invented scores
    gs.course_from_wire(course)  # shape/rule validation passes


def test_normalize_coerces_string_item_weight():
    data = {
        "name": "X",
        "categories": [
            {
                "name": "Tests",
                "weight": 30,
                "rule": {"kind": "fixedWeights"},
                "items": [{"name": "T1", "weight": "30"}],
            }
        ],
        "cutoffs": [{"letter": "A", "min": 90}],
    }
    course = syl.normalize_parsed_course(data)
    assert course["categories"][0]["items"][0]["weight"] == 30.0
