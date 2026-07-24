from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from AutoGrader.prompt_loader import (
    DEFAULT_PROMPTS_PATH,
    PromptCatalog,
    PromptConfigurationError,
)


class PromptCatalogTests(unittest.TestCase):
    def test_default_catalog_is_valid_and_renders_placeholders(self) -> None:
        catalog = PromptCatalog()

        rendered = catalog.render(
            "multi_agent.attempt_header",
            question_attempt_id="paper-a:1:5",
            displayed_label="5",
        )

        self.assertEqual(rendered, "ID=paper-a:1:5; LABEL=5")
        self.assertIn("compact JSON", catalog.get("multi_agent.evaluator_system"))

    def test_catalog_reloads_after_external_edit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "prompts.json"
            data = json.loads(DEFAULT_PROMPTS_PATH.read_text(encoding="utf-8"))
            path.write_text(json.dumps(data), encoding="utf-8")
            catalog = PromptCatalog(path)
            self.assertEqual(
                catalog.render(
                    "question_splitter.single_page.candidate_label",
                    orientation="r90",
                ),
                "Candidate r90",
            )

            data["question_splitter"]["single_page"]["candidate_label"] = (
                "Rotated candidate ${orientation}"
            )
            path.write_text(json.dumps(data), encoding="utf-8")

            self.assertEqual(
                catalog.render(
                    "question_splitter.single_page.candidate_label",
                    orientation="r90",
                ),
                "Rotated candidate r90",
            )

    def test_invalid_catalog_fails_with_clear_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "prompts.json"
            path.write_text('{"version": 2}', encoding="utf-8")

            with self.assertRaisesRegex(PromptConfigurationError, "version 1"):
                PromptCatalog(path).get("recognizer.system")

    def test_invalid_placeholder_is_rejected_during_loading(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "prompts.json"
            data = json.loads(DEFAULT_PROMPTS_PATH.read_text(encoding="utf-8"))
            data["recognizer"]["question_label"] = "PAIR ${wrong_name}"
            path.write_text(json.dumps(data), encoding="utf-8")

            with self.assertRaisesRegex(PromptConfigurationError, "question_label"):
                PromptCatalog(path).get("recognizer.system")

    def test_missing_render_value_fails_with_prompt_key(self) -> None:
        with self.assertRaisesRegex(PromptConfigurationError, "attempt_header"):
            PromptCatalog().render(
                "multi_agent.attempt_header",
                question_attempt_id="paper-a:1:5",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
