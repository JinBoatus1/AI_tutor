"""Standalone full-capability test suite for a deployed local LLM server.

This file is intentionally independent of AI Tutor's production chain: it does
not import ``deps`` or ``backend.llm`` and uses only the OpenAI Python SDK.

PowerShell example (Ollama):

    $env:LOCAL_LLM_FULL_TEST = "1"
    $env:LOCAL_LLM_TEST_BASE_URL = "http://127.0.0.1:11434/v1"
    $env:LOCAL_LLM_TEST_API_KEY = "local"
    $env:LOCAL_LLM_TEST_TEXT_MODEL = "qwen3:8b"
    $env:LOCAL_LLM_TEST_TOOL_MODEL = "qwen3:8b"
    $env:LOCAL_LLM_TEST_VISION_MODEL = "qwen3-vl:8b"
    python -m unittest test_local_llm -v

For llama.cpp, LM Studio, or vLLM, change only the URL, key, and served model
names. Every capability is isolated: tests that need a missing model variable
are skipped, while failures in one capability do not stop the remaining tests.
Set LOCAL_LLM_TEST_CONCURRENCY to 2 or more to enable the optional concurrency
test. No production environment variables or application data are read.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import unittest
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from openai import OpenAI


ENABLED = os.getenv("LOCAL_LLM_FULL_TEST", "").strip().lower() in {"1", "true", "yes", "on"}
BASE_URL = os.getenv("LOCAL_LLM_TEST_BASE_URL", "http://127.0.0.1:11434/v1").strip()
API_KEY = os.getenv("LOCAL_LLM_TEST_API_KEY", "local").strip() or "local"
TEXT_MODEL = os.getenv("LOCAL_LLM_TEST_TEXT_MODEL", "").strip()
TOOL_MODEL = os.getenv("LOCAL_LLM_TEST_TOOL_MODEL", "").strip()
VISION_MODEL = os.getenv("LOCAL_LLM_TEST_VISION_MODEL", "").strip()


def _positive_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


def _nonnegative_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0, value)


TIMEOUT_SECONDS = _positive_float("LOCAL_LLM_TEST_TIMEOUT_SECONDS", 180.0)
CONCURRENCY = _nonnegative_int("LOCAL_LLM_TEST_CONCURRENCY", 1)


def _message_text(response: Any) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        raise AssertionError("The server returned no completion choices.")
    return choices[0].message.content or ""


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start < 0 or end <= start:
            raise
        value = json.loads(cleaned[start : end + 1])
    if not isinstance(value, dict):
        raise AssertionError(f"Expected a JSON object, received {type(value).__name__}.")
    return value


def _vision_fixture_data_url() -> str:
    try:
        from PIL import Image, ImageDraw
    except ImportError as exc:
        raise unittest.SkipTest("Pillow is required for the generated vision fixture.") from exc

    image = Image.new("RGB", (640, 320), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((60, 60, 260, 260), fill=(20, 90, 220), outline=(0, 0, 0), width=5)
    draw.text((330, 140), "BLUE SQUARE", fill=(0, 0, 0))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


@unittest.skipUnless(
    ENABLED,
    "set LOCAL_LLM_FULL_TEST=1 after an OpenAI-compatible local server is running",
)
class LocalLlmFullCapabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = OpenAI(api_key=API_KEY, base_url=BASE_URL, timeout=TIMEOUT_SECONDS)

    def _require_text_model(self) -> str:
        if not TEXT_MODEL:
            self.skipTest("set LOCAL_LLM_TEST_TEXT_MODEL to enable text-based tests")
        return TEXT_MODEL

    def test_10_models_endpoint_lists_configured_models(self):
        response = self.client.models.list()
        served = {item.id for item in response.data}
        self.assertTrue(served, "GET /v1/models returned an empty model list")
        for configured in {TEXT_MODEL, TOOL_MODEL, VISION_MODEL} - {""}:
            self.assertIn(configured, served, f"configured model {configured!r} is not served")

    def test_20_basic_text_completion(self):
        model = self._require_text_model()
        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Reply with exactly: LOCAL_TEXT_OK"}],
            temperature=0,
            max_tokens=64,
        )
        self.assertIn("LOCAL_TEXT_OK", _message_text(response))

    def test_30_chinese_instruction_following(self):
        model = self._require_text_model()
        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你必须严格遵循用户要求，并使用中文回答。"},
                {"role": "user", "content": "只回复这五个字：数学归纳法"},
            ],
            temperature=0,
            max_tokens=64,
        )
        self.assertIn("数学归纳法", _message_text(response))

    def test_40_json_object_output(self):
        model = self._require_text_model()
        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": (
                        'Return one JSON object only, with exactly these values: '
                        '{"status":"ok","score":7}. Do not use Markdown.'
                    ),
                }
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=128,
        )
        self.assertEqual(_parse_json_object(_message_text(response)), {"status": "ok", "score": 7})

    def test_50_streaming_completion(self):
        model = self._require_text_model()
        stream = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Reply with exactly: LOCAL_STREAM_OK"}],
            temperature=0,
            max_tokens=64,
            stream=True,
        )
        chunks: list[str] = []
        for event in stream:
            if event.choices and event.choices[0].delta.content:
                chunks.append(event.choices[0].delta.content)
        self.assertIn("LOCAL_STREAM_OK", "".join(chunks))

    def test_60_tool_call_and_result_round_trip(self):
        if not TOOL_MODEL:
            self.skipTest("set LOCAL_LLM_TEST_TOOL_MODEL to enable tool-call testing")

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "add_numbers",
                    "description": "Add two integers. Always use this tool for addition requests.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "a": {"type": "integer"},
                            "b": {"type": "integer"},
                        },
                        "required": ["a", "b"],
                        "additionalProperties": False,
                    },
                },
            }
        ]
        messages: list[dict[str, Any]] = [
            {"role": "user", "content": "Use add_numbers to calculate 7 + 5."}
        ]
        first = self.client.chat.completions.create(
            model=TOOL_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0,
            max_tokens=256,
        )
        assistant = first.choices[0].message
        calls = assistant.tool_calls or []
        self.assertTrue(calls, "model answered directly instead of producing a tool call")
        call = calls[0]
        self.assertEqual(call.function.name, "add_numbers")
        arguments = json.loads(call.function.arguments)
        self.assertEqual(arguments, {"a": 7, "b": 5})

        messages.append(assistant.model_dump(exclude_none=True))
        messages.append({"role": "tool", "tool_call_id": call.id, "content": "12"})
        final = self.client.chat.completions.create(
            model=TOOL_MODEL,
            messages=messages,
            tools=tools,
            temperature=0,
            max_tokens=128,
        )
        self.assertRegex(_message_text(final), r"(?<!\d)12(?!\d)")

    def test_70_vision_image_understanding(self):
        if not VISION_MODEL:
            self.skipTest("set LOCAL_LLM_TEST_VISION_MODEL to enable vision testing")

        response = self.client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Identify the large colored shape. Reply with exactly two lowercase words.",
                        },
                        {"type": "image_url", "image_url": {"url": _vision_fixture_data_url()}},
                    ],
                }
            ],
            temperature=0,
            max_tokens=64,
        )
        answer = _message_text(response).lower()
        self.assertIn("blue", answer)
        self.assertIn("square", answer)

    def test_80_optional_concurrent_requests(self):
        if CONCURRENCY < 2:
            self.skipTest("set LOCAL_LLM_TEST_CONCURRENCY=2 or higher to test concurrent requests")
        model = self._require_text_model()

        def request(index: int) -> str:
            client = OpenAI(api_key=API_KEY, base_url=BASE_URL, timeout=TIMEOUT_SECONDS)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": f"Reply with exactly: REQUEST_{index}_OK"}],
                temperature=0,
                max_tokens=64,
            )
            return _message_text(response)

        with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
            answers = list(executor.map(request, range(CONCURRENCY)))

        for index, answer in enumerate(answers):
            self.assertIn(f"REQUEST_{index}_OK", answer)


if __name__ == "__main__":
    unittest.main(verbosity=2)
