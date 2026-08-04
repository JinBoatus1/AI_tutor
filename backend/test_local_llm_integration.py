"""Opt-in smoke test for a running OpenAI-compatible local model.

Run only after the model server is available:
  $env:LOCAL_LLM_TEST='1'
  $env:LLM_BASE_URL='http://127.0.0.1:11434/v1'
  $env:LLM_TEXT_MODEL='qwen3:8b'
  python -m unittest test_local_llm_integration -v
"""

import os
import unittest

from openai import OpenAI


@unittest.skipUnless(
    os.getenv("LOCAL_LLM_TEST") == "1",
    "set LOCAL_LLM_TEST=1 when a local model server is running",
)
class LocalLlmIntegrationTests(unittest.TestCase):
    def test_local_openai_compatible_chat_chain(self):
        base_url = os.getenv("LLM_BASE_URL", "http://127.0.0.1:11434/v1")
        model = os.getenv("LLM_TEXT_MODEL", "qwen3:8b")
        api_key = os.getenv("LLM_API_KEY", "local-llm")
        local_client = OpenAI(api_key=api_key, base_url=base_url, timeout=180.0)

        response = local_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Reply with exactly: LOCAL_LLM_OK"}],
            temperature=0,
            max_tokens=32,
        )

        content = response.choices[0].message.content or ""
        self.assertIn("LOCAL_LLM_OK", content)


if __name__ == "__main__":
    unittest.main()
