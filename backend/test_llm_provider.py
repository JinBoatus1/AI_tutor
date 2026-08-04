"""Offline tests for the OpenAI-compatible LLM adapter."""

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import deps


class _FakeCompletions:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(choices=[])


class _FakeClient:
    def __init__(self):
        self.completions = _FakeCompletions()
        self.chat = SimpleNamespace(completions=self.completions)


class LlmProviderTests(unittest.TestCase):
    def test_default_model_is_preserved_without_override(self):
        with patch.object(deps, "LLM_TEXT_MODEL", None), patch.object(deps, "LLM_VISION_MODEL", None):
            actual = deps.resolve_llm_model("gpt-5.2", [{"role": "user", "content": "hi"}])
        self.assertEqual(actual, "gpt-5.2")

    def test_configured_text_and_vision_models_are_routed(self):
        text = [{"role": "user", "content": "explain induction"}]
        image = [{"role": "user", "content": [
            {"type": "text", "text": "grade this"},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,AA=="}},
        ]}]
        with patch.object(deps, "LLM_TEXT_MODEL", "qwen3:8b"), patch.object(
            deps, "LLM_VISION_MODEL", "qwen3-vl:8b"
        ):
            self.assertEqual(deps.resolve_llm_model("gpt-5.2", text), "qwen3:8b")
            self.assertEqual(deps.resolve_llm_model("gpt-5.2", image), "qwen3-vl:8b")

    def test_completion_uses_adapter_model_and_timeout(self):
        fake = _FakeClient()
        with patch.object(deps, "client", fake), patch.object(
            deps, "LLM_TEXT_MODEL", "local-text"
        ), patch.object(deps, "LLM_VISION_MODEL", "local-vision"), patch.object(
            deps, "LLM_TIMEOUT_SECONDS", 123.0
        ):
            deps.create_chat_completion(
                model="gpt-5.2",
                messages=[{"role": "user", "content": "hello"}],
                temperature=0,
            )

        self.assertEqual(fake.completions.calls, [{
            "model": "local-text",
            "messages": [{"role": "user", "content": "hello"}],
            "temperature": 0,
            "timeout": 123.0,
        }])

    def test_status_never_exposes_api_key(self):
        with patch.object(deps, "API_KEY", "top-secret-value"):
            status = deps.get_llm_status()
        self.assertTrue(status["api_key_configured"])
        self.assertNotIn("top-secret-value", repr(status))


if __name__ == "__main__":
    unittest.main()
