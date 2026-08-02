"""No-model provider for exercising the application integration locally."""

from __future__ import annotations

import time
from types import SimpleNamespace
from typing import Any


class MockProvider:
    def __init__(self, response_text: str):
        self.response_text = response_text

    def create_chat_completion(self, **kwargs: Any) -> Any:
        message = SimpleNamespace(content=self.response_text, role="assistant", tool_calls=None)
        choice = SimpleNamespace(index=0, finish_reason="stop", message=message)
        return SimpleNamespace(
            id="chatcmpl-mock",
            object="chat.completion",
            created=int(time.time()),
            model=kwargs.get("model", "mock"),
            choices=[choice],
            usage=SimpleNamespace(prompt_tokens=0, completion_tokens=0, total_tokens=0),
        )

    def health(self) -> dict[str, Any]:
        return {"reachable": True, "models": ["mock"]}
