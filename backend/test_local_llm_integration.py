"""Opt-in smoke test for a running OpenAI-compatible local model.

Run only after the model server is available:
  $env:LOCAL_LLM_TEST='1'
  $env:LLM_BASE_URL='http://127.0.0.1:11434/v1'
  $env:LLM_MODEL='qwen3:8b'
  python -m unittest test_local_llm_integration -v
"""

import os
import unittest

from deps import create_chat_completion
from llm.gateway import get_llm_gateway


@unittest.skipUnless(
    os.getenv("LOCAL_LLM_TEST") == "1",
    "set LOCAL_LLM_TEST=1 when a local model server is running",
)
class LocalLlmIntegrationTests(unittest.TestCase):
    def test_local_openai_compatible_chat_chain(self):
        # Exercise the same deps -> gateway -> provider chain used by the app.
        get_llm_gateway.cache_clear()
        response = create_chat_completion(
            model=os.getenv("LLM_MODEL", "qwen3:8b"),
            messages=[{"role": "user", "content": "Reply with exactly: LOCAL_LLM_OK"}],
            temperature=0,
            max_tokens=32,
        )

        content = response.choices[0].message.content or ""
        self.assertIn("LOCAL_LLM_OK", content)

    @classmethod
    def tearDownClass(cls):
        get_llm_gateway.cache_clear()


if __name__ == "__main__":
    unittest.main()
