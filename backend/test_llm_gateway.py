"""Unit tests for backend-independent LLM routing."""

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import deps
from llm.capabilities import ModelRegistry, ModelSpec, required_capabilities
from llm.config import LLMSettings
from llm.gateway import LLMGateway, LLMGatewayError, get_llm_gateway


class FakeProvider:
    def __init__(self):
        self.request = None

    def create_chat_completion(self, **kwargs):
        self.request = kwargs
        return SimpleNamespace(choices=[])

    def health(self):
        return {"reachable": True, "models": ["aitutor-main"]}


def _settings(tmp_path: Path, **overrides) -> LLMSettings:
    values = {
        "provider": "mock",
        "backend": "mock",
        "base_url": None,
        "api_key": "local",
        "default_model": "aitutor-main",
        "vision_model": "aitutor-vision",
        "tool_model": "aitutor-main",
        "timeout_seconds": 90.0,
        "validate_capabilities": True,
        "registry_path": tmp_path / "missing.json",
        "mock_response": "mock",
    }
    values.update(overrides)
    return LLMSettings(**values)


def _registry() -> ModelRegistry:
    return ModelRegistry(
        {
            "aitutor-main": ModelSpec("aitutor-main", frozenset({"text", "json", "tools"})),
            "aitutor-vision": ModelSpec("aitutor-vision", frozenset({"text", "vision", "json"})),
        }
    )


class LLMGatewayTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_text_request_rewrites_legacy_model(self):
        provider = FakeProvider()
        gateway = LLMGateway(_settings(self.temp_path), provider=provider, registry=_registry())

        gateway.create_chat_completion(model="gpt-5.2", messages=[{"role": "user", "content": "hi"}])

        self.assertEqual(provider.request["model"], "aitutor-main")
        self.assertEqual(provider.request["timeout"], 90.0)

    def test_cloud_default_preserves_requested_model(self):
        provider = FakeProvider()
        settings = _settings(
            self.temp_path,
            provider="openai",
            backend="openai",
            default_model=None,
            vision_model=None,
            tool_model=None,
        )
        gateway = LLMGateway(settings, provider=provider, registry=_registry())

        gateway.create_chat_completion(model="gpt-5.2", messages=[{"role": "user", "content": "hi"}])

        self.assertEqual(provider.request["model"], "gpt-5.2")

    def test_vision_request_uses_vision_model(self):
        provider = FakeProvider()
        gateway = LLMGateway(_settings(self.temp_path), provider=provider, registry=_registry())
        messages = [
            {
                "role": "user",
                "content": [{"type": "image_url", "image_url": {"url": "data:image/png;base64,AA=="}}],
            }
        ]

        gateway.create_chat_completion(model="gpt-5.2", messages=messages)

        self.assertEqual(provider.request["model"], "aitutor-vision")

    def test_registered_model_rejects_missing_capability(self):
        provider = FakeProvider()
        settings = _settings(self.temp_path, vision_model=None)
        gateway = LLMGateway(settings, provider=provider, registry=_registry())
        messages = [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "x"}}]}]

        with self.assertRaisesRegex(LLMGatewayError, "vision"):
            gateway.create_chat_completion(model="gpt-5.2", messages=messages)

    def test_capability_detection_for_tools_and_json(self):
        required = required_capabilities(
            {
                "messages": [{"role": "user", "content": "hi"}],
                "tools": [{"type": "function", "function": {"name": "lookup"}}],
                "response_format": {"type": "json_object"},
            }
        )

        self.assertEqual(required, {"text", "tools", "json"})

    def test_health_probe_uses_provider(self):
        gateway = LLMGateway(_settings(self.temp_path), provider=FakeProvider(), registry=_registry())

        result = gateway.health(check_remote=True)

        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["remote"]["models"], ["aitutor-main"])

    def test_environment_config_normalizes_openai_base_url(self):
        env = {
            "LLM_PROVIDER": "openai_compatible",
            "LLM_BACKEND": "llama_cpp",
            "LLM_BASE_URL": "http://127.0.0.1:8080/",
            "LLM_MODEL": "aitutor-main",
        }
        with patch.dict("os.environ", env, clear=True):
            settings = LLMSettings.from_env()

        self.assertEqual(settings.base_url, "http://127.0.0.1:8080/v1")
        self.assertEqual(settings.api_key, "local")

    def test_explicit_cloud_provider_ignores_local_base_url(self):
        env = {
            "LLM_PROVIDER": "openai",
            "LLM_BASE_URL": "http://127.0.0.1:8080/v1",
            "OPENAI_API_KEY": "test-key",
        }
        with patch.dict("os.environ", env, clear=True):
            settings = LLMSettings.from_env()

        self.assertIsNone(settings.base_url)
        self.assertEqual(settings.api_key, "test-key")

    def test_mock_provider_preserves_chat_completion_shape(self):
        gateway = LLMGateway(_settings(self.temp_path), registry=_registry())

        response = gateway.create_chat_completion(
            model="gpt-5.2",
            messages=[{"role": "user", "content": "ping"}],
        )

        self.assertEqual(response.model, "aitutor-main")
        self.assertEqual(response.choices[0].message.content, "mock")

    def test_deps_entrypoint_uses_gateway_without_cloud_or_local_server(self):
        env = {
            "LLM_PROVIDER": "mock",
            "LLM_MODEL": "aitutor-main",
            "LLM_MOCK_RESPONSE": "gateway-ok",
        }
        try:
            with patch.dict("os.environ", env, clear=True):
                get_llm_gateway.cache_clear()
                response = deps.create_chat_completion(
                    model="gpt-5.2",
                    messages=[{"role": "user", "content": "ping"}],
                )
                health = deps.get_llm_health()
        finally:
            get_llm_gateway.cache_clear()

        self.assertEqual(response.model, "aitutor-main")
        self.assertEqual(response.choices[0].message.content, "gateway-ok")
        self.assertEqual(health["status"], "configured")
        self.assertNotIn("api_key", health["config"])


if __name__ == "__main__":
    unittest.main()
