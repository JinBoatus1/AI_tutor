"""Eval runners for batch fixture execution."""

from __future__ import annotations

from typing import Any, Callable

from evals.fixtures import load_practice_t1_cases, problem_from_fixture
from evals.practice_prompts import build_grade_prompt, parse_verdict, verdict_to_api


def _default_grade_fn(prompt: str) -> str:
    from deps import create_chat_completion

    resp = create_chat_completion(
        model="gpt-5.2",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an AI math tutor in evaluation mode. "
                    "Follow the user's instructions exactly."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
    )
    return (resp.choices[0].message.content or "").strip()


def run_practice_t1_eval(
    grade_fn: Callable[[str], str] | None = None,
) -> dict[str, Any]:
    """Run T1 go/no-go eval over all practice_ch4_proofs fixtures."""
    grade = grade_fn or _default_grade_fn
    cases = load_practice_t1_cases()
    results: list[dict[str, Any]] = []
    passed = 0

    for case in cases:
        case_id = str(case.get("id") or "unknown")
        expected = str(case.get("expected_verdict") or "").upper()
        problem = problem_from_fixture(case)
        attempt = str(case.get("attempt") or case.get("student_attempt") or "")
        prompt = build_grade_prompt(problem, attempt)
        raw_reply = grade(prompt)
        verdict = parse_verdict(raw_reply)
        actual = verdict_to_api(verdict)
        ok = actual == expected
        if ok:
            passed += 1
        results.append(
            {
                "id": case_id,
                "expected_verdict": expected,
                "actual_verdict": actual,
                "passed": ok,
                "raw_reply": raw_reply,
                "description": case.get("description"),
            }
        )

    total = len(cases)
    return {
        "suite": "practice_t1",
        "passed": passed,
        "total": total,
        "pass_rate": (passed / total) if total else 0.0,
        "go": passed == total and total > 0,
        "results": results,
    }
