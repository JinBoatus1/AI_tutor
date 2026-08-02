"""Provider shared by OpenAI cloud, vLLM, llama.cpp, and LM Studio."""

from __future__ import annotations

from typing import Any

from openai import OpenAI


class OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None = None,
        timeout_seconds: float = 90.0,
    ):
        client_kwargs: dict[str, Any] = {"api_key": api_key, "timeout": timeout_seconds}
        if base_url:
            client_kwargs["base_url"] = base_url
        self.client = OpenAI(**client_kwargs)

    def create_chat_completion(self, **kwargs: Any) -> Any:
        return self.client.chat.completions.create(**kwargs)

    def health(self) -> dict[str, Any]:
        models = self.client.models.list()
        return {
            "reachable": True,
            "models": [item.id for item in models.data],
        }
