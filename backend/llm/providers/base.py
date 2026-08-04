"""Provider protocol used by the LLM gateway."""

from __future__ import annotations

from typing import Any, Protocol


class LLMProvider(Protocol):
    def create_chat_completion(self, **kwargs: Any) -> Any:
        ...

    def health(self) -> dict[str, Any]:
        ...
