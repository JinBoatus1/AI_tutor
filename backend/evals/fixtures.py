"""Load eval fixtures from JSONL files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from evals.practice_prompts import ChallengeProblem

_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.is_file():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def load_practice_t1_cases() -> list[dict[str, Any]]:
    return load_jsonl(_FIXTURES_DIR / "practice_ch4_proofs.jsonl")


def problem_from_fixture(case: dict[str, Any]) -> ChallengeProblem:
    problem = case.get("problem") or {}
    return {
        "id": str(problem.get("id") or case.get("problem_id") or case.get("id") or "unknown"),
        "prompt": str(problem.get("prompt") or ""),
        "solution": str(problem.get("solution") or ""),
        "rubric": str(problem.get("rubric") or ""),
    }
