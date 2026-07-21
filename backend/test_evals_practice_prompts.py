"""Unit tests for eval practice prompts (no LLM)."""

from evals.practice_prompts import (
    SOLUTION_VISIBLE_FROM,
    build_grade_prompt,
    build_hint_prompt,
    parse_verdict,
)


PROBLEM = {
    "id": "c1",
    "prompt": "Prove that if n^2 is even then n is even.",
    "solution": "Contrapositive: assume n=2k+1, then n^2=4k^2+4k+1 is odd. SECRET_SOLUTION_MARKER.",
    "rubric": "Uses contraposition; algebra correct; concludes.",
}


def test_build_grade_prompt_contains_verdict_instruction():
    prompt = build_grade_prompt(PROBLEM, "my attempt")
    assert "GRADING MODE" in prompt
    assert "SECRET_SOLUTION_MARKER" in prompt
    assert "VERDICT: CORRECT" in prompt


def test_hint_leak_guard_below_l4():
    attempt = "I tried assuming n is even but got stuck."
    for rung in (1, 2, 3):
        prompt = build_hint_prompt(rung, PROBLEM, attempt)
        assert "SECRET_SOLUTION_MARKER" not in prompt
        assert f"rung L{rung}" in prompt


def test_hint_includes_solution_at_l4_plus():
    attempt = "work"
    for rung in (4, 5, 6):
        assert "SECRET_SOLUTION_MARKER" in build_hint_prompt(rung, PROBLEM, attempt)


def test_solution_visible_from_is_l4():
    assert SOLUTION_VISIBLE_FROM == 4


def test_parse_verdict():
    assert parse_verdict("VERDICT: CORRECT\nbecause...") == "correct"
    assert parse_verdict("verdict: incorrect — bad step") == "incorrect"
    assert parse_verdict("VERDICT: INCOMPLETE") == "incomplete"
    assert parse_verdict("I think you're close!") == "incomplete"
