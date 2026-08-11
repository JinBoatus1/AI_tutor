"""FastAPI runtime regression tests for the LLM gateway integration."""

import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

import api_routes
from llm.gateway import get_llm_gateway


class LlmRuntimeRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app = FastAPI()
        app.include_router(api_routes.router)
        cls.client = TestClient(app)

    def setUp(self):
        self.env = patch.dict(
            "os.environ",
            {
                "LLM_PROVIDER": "mock",
                "LLM_MODEL": "aitutor-main",
                "LLM_MOCK_RESPONSE": "A mock definition.",
            },
            clear=True,
        )
        self.env.start()
        get_llm_gateway.cache_clear()

    def tearDown(self):
        get_llm_gateway.cache_clear()
        self.env.stop()

    def test_simple_chat_uses_async_gateway_path(self):
        response = self.client.post(
            "/api/chat",
            json={"message": "What is induction?", "history": []},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"reply": "A mock definition."})


if __name__ == "__main__":
    unittest.main()
