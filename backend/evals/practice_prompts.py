"""Practice-mode prompt builders and verdict parsing (ported from frontend hintLadder.ts)."""

from __future__ import annotations

import re
from typing import Literal, TypedDict

GradeVerdict = Literal["correct", "incorrect", "incomplete"]


class ChallengeProblem(TypedDict):
    id: str
    prompt: str
    solution: str
    rubric: str


SOLUTION_VISIBLE_FROM = 4

RUNG_RULES: dict[int, str] = {
    0: "",
    1: "Give ONLY brief encouragement and one Socratic refocus question. Reveal no content.",
    2: "Name the proof technique or key concept to consider. Do NOT give steps, algebra, variables, or the answer.",
    3: "Point the student to the relevant FOCS textbook section by number. Do NOT give steps or the answer.",
    4: "Set up ONLY the first step, then hand it back and ask the student to continue. Do not finish the proof.",
    5: "Give the full step-by-step proof, pausing after each step to ask the student why that step works.",
    6: "Give the final, complete proof.",
}


def build_hint_prompt(rung: int, problem: ChallengeProblem, attempt: str) -> str:
    include_solution = rung >= SOLUTION_VISIBLE_FROM
    lines = [
        f"PRACTICE HINT MODE, rung L{rung} of 6. Ignore textbook page matching and do not return reference pages.",
        f"You are a practice tutor helping a stuck student. {RUNG_RULES.get(rung, '')}",
        f"PROBLEM: {problem['prompt']}",
        (
            f'STUDENT\'S WORK SO FAR: """{attempt.strip()}"""'
            if attempt.strip()
            else "The student has not shown work yet."
        ),
    ]
    if include_solution:
        lines.append(
            "CANONICAL SOLUTION (guide toward it; reveal only as this rung permits): "
            f"{problem['solution']}"
        )
    return "\n".join(line for line in lines if line)


def build_grade_prompt(problem: ChallengeProblem, attempt: str) -> str:
    return "\n".join(
        [
            "GRADING MODE. Ignore textbook page matching; do not return reference pages.",
            "A student submitted a proof. Decide if it is an essentially correct, rigorous proof.",
            f"PROBLEM: {problem['prompt']}",
            f"REFERENCE SOLUTION: {problem['solution']}",
            f"RUBRIC: {problem['rubric']}",
            f'STUDENT SUBMISSION: """{attempt.strip()}"""',
            "Your FIRST line must be exactly one of: VERDICT: CORRECT | VERDICT: INCORRECT | VERDICT: INCOMPLETE.",
            "Then one short sentence explaining why.",
        ]
    )


_VERDICT_RE = re.compile(r"VERDICT:\s*(CORRECT|INCORRECT|INCOMPLETE)", re.IGNORECASE)


def parse_verdict(reply: str) -> GradeVerdict:
    m = _VERDICT_RE.search(reply or "")
    if m:
        return m.group(1).lower()  # type: ignore[return-value]
    return "incomplete"


def verdict_to_api(verdict: GradeVerdict) -> str:
    return verdict.upper()
