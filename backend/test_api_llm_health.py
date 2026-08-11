"""Route-level regression tests for LLM diagnostics."""

import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
from llm.gateway import get_llm_gateway


class LlmHealthRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = FastAPI()
        app.include_router(api_routes.router)
        cls.client = TestClient(app)

    def setUp(self):
        self.env = patch.dict(
            "os.environ",
            {"OPENAI_API_KEY": "test-key", "LLM_HEALTH_TOKEN": "health-secret"},
            clear=True,
        )
        self.env.start()
        get_llm_gateway.cache_clear()

    def tearDown(self):
        get_llm_gateway.cache_clear()
        self.env.stop()

    def test_health_route_returns_non_secret_openai_default(self):
        response = self.client.get("/api/llm/health")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body, {"status": "configured"})

    def test_detailed_health_requires_token_and_hides_paths_and_keys(self):
        denied = self.client.get("/api/llm/health?details=true")
        self.assertEqual(denied.status_code, 403)

        response = self.client.get(
            "/api/llm/health?details=true",
            headers={"X-LLM-Health-Token": "health-secret"},
        )
        self.assertEqual(response.status_code, 200)
        config = response.json()["config"]
        self.assertEqual(config["provider"], "openai")
        self.assertNotIn("api_key", config)
        self.assertNotIn("registry_path", config)

    def test_remote_probe_requires_token(self):
        response = self.client.get("/api/llm/health?check_remote=true")
        self.assertEqual(response.status_code, 403)

    def test_status_alias_uses_same_handler(self):
        health = self.client.get("/api/llm/health").json()
        status = self.client.get("/api/llm/status").json()

        self.assertEqual(status, health)


if __name__ == "__main__":
    unittest.main()
