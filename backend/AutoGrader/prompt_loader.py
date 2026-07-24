"""Validated, reloadable access to externally editable AutoGrader prompts."""

from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from typing import Any


DEFAULT_PROMPTS_PATH = Path(__file__).with_name("prompts.json")
_PLACEHOLDER = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
_REQUIRED_KEYS = (
    "question_splitter.single_page.system",
    "question_splitter.single_page.user",
    "question_splitter.single_page.candidate_label",
    "question_splitter.paired_pages.system",
    "question_splitter.paired_pages.user",
    "question_splitter.paired_pages.question_candidate_label",
    "question_splitter.paired_pages.answer_candidate_label",
    "recognizer.system",
    "recognizer.user",
    "recognizer.question_label",
    "recognizer.answer_label",
    "multi_agent.evaluator_system",
    "multi_agent.role_focus",
    "multi_agent.attempt_header",
    "multi_agent.grading_criteria",
    "multi_agent.recognized_question",
    "multi_agent.recognized_answer",
    "multi_agent.question_only",
    "multi_agent.rubric_wrapper",
    "multi_agent.arbitration_context",
    "multi_agent.arbitrator_instruction",
    "multi_agent.roles.solution_verifier.instruction",
    "multi_agent.roles.solution_verifier.image_policy",
    "multi_agent.roles.rubric_grader.instruction",
    "multi_agent.roles.rubric_grader.image_policy",
    "multi_agent.roles.critical_reviewer.instruction",
    "multi_agent.roles.critical_reviewer.image_policy",
)
_EXPECTED_PLACEHOLDERS = {
    "question_splitter.single_page.candidate_label": {"orientation"},
    "question_splitter.paired_pages.question_candidate_label": {"orientation"},
    "question_splitter.paired_pages.answer_candidate_label": {"orientation"},
    "recognizer.question_label": {"label"},
    "recognizer.answer_label": {"label"},
    "multi_agent.role_focus": {"role_instruction"},
    "multi_agent.attempt_header": {"question_attempt_id", "displayed_label"},
    "multi_agent.grading_criteria": {"grading_criteria"},
    "multi_agent.recognized_question": {"question_text"},
    "multi_agent.recognized_answer": {"answer_text"},
    "multi_agent.rubric_wrapper": {"rubric_json"},
    "multi_agent.arbitration_context": {"candidates_json"},
}


class PromptConfigurationError(RuntimeError):
    """Raised when the prompt catalog is missing or malformed."""


class PromptCatalog:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path or DEFAULT_PROMPTS_PATH).expanduser().resolve()
        self._signature: tuple[int, int] | None = None
        self._data: dict[str, Any] = {}
        self._lock = threading.RLock()

    @staticmethod
    def _lookup(data: dict[str, Any], dotted_key: str) -> Any:
        value: Any = data
        for part in dotted_key.split("."):
            if not isinstance(value, dict) or part not in value:
                raise PromptConfigurationError(f"Missing AutoGrader prompt key: {dotted_key}")
            value = value[part]
        return value

    def _load_if_changed(self) -> None:
        try:
            stat = self.path.stat()
        except OSError as exc:
            raise PromptConfigurationError(f"Cannot read AutoGrader prompts: {self.path}") from exc
        signature = (stat.st_mtime_ns, stat.st_size)
        if signature == self._signature:
            return

        with self._lock:
            if signature == self._signature:
                return
            try:
                loaded = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise PromptConfigurationError(f"Invalid AutoGrader prompt JSON: {self.path}") from exc
            if not isinstance(loaded, dict) or loaded.get("version") != 1:
                raise PromptConfigurationError("AutoGrader prompts must be a version 1 JSON object")
            for key in _REQUIRED_KEYS:
                value = self._lookup(loaded, key)
                if not isinstance(value, str) or not value.strip():
                    raise PromptConfigurationError(f"AutoGrader prompt key must be non-empty text: {key}")
                placeholders = set(_PLACEHOLDER.findall(value))
                expected = _EXPECTED_PLACEHOLDERS.get(key, set())
                if placeholders != expected:
                    raise PromptConfigurationError(
                        f"AutoGrader prompt placeholders for {key} must be {sorted(expected)}"
                    )
            self._data = loaded
            self._signature = signature

    def get(self, dotted_key: str) -> str:
        self._load_if_changed()
        value = self._lookup(self._data, dotted_key)
        if not isinstance(value, str):
            raise PromptConfigurationError(f"AutoGrader prompt key is not text: {dotted_key}")
        return value

    def render(self, dotted_key: str, **values: object) -> str:
        template = self.get(dotted_key)

        def replace(match: re.Match[str]) -> str:
            name = match.group(1)
            if name not in values:
                raise PromptConfigurationError(
                    f"Missing value {name!r} for AutoGrader prompt: {dotted_key}"
                )
            return str(values[name])

        return _PLACEHOLDER.sub(replace, template)


_configured_path = os.getenv("AUTOGRADER_PROMPTS_PATH", "").strip()
PROMPTS = PromptCatalog(_configured_path or DEFAULT_PROMPTS_PATH)


def get_prompt(dotted_key: str) -> str:
    return PROMPTS.get(dotted_key)


def render_prompt(dotted_key: str, **values: object) -> str:
    return PROMPTS.render(dotted_key, **values)
