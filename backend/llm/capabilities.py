"""Request capability detection and model metadata loading."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


KNOWN_CAPABILITIES = frozenset({"text", "vision", "tools", "json"})


def required_capabilities(request: dict[str, Any]) -> set[str]:
    required = {"text"}
    if request.get("tools") or request.get("tool_choice") not in (None, "none"):
        required.add("tools")
    if request.get("response_format"):
        required.add("json")
    if _contains_image(request.get("messages", [])):
        required.add("vision")
    return required


def _contains_image(value: Any) -> bool:
    if isinstance(value, dict):
        part_type = value.get("type")
        if part_type in {"image", "image_url", "input_image"}:
            return True
        return any(_contains_image(item) for item in value.values())
    if isinstance(value, (list, tuple)):
        return any(_contains_image(item) for item in value)
    return False


@dataclass(frozen=True)
class ModelSpec:
    name: str
    capabilities: frozenset[str]
    description: str = ""
    windows_format: str | None = None
    server_format: str | None = None


class ModelRegistry:
    def __init__(self, models: dict[str, ModelSpec], aliases: dict[str, str] | None = None):
        self.models = models
        self.aliases = aliases or {}

    @classmethod
    def load(cls, path: Path) -> "ModelRegistry":
        if not path.is_file():
            return cls({})
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        models: dict[str, ModelSpec] = {}
        for name, raw in payload.get("models", {}).items():
            capabilities = frozenset(str(item).lower() for item in raw.get("capabilities", []))
            unknown = capabilities - KNOWN_CAPABILITIES
            if unknown:
                raise ValueError(f"Model {name!r} has unknown capabilities: {sorted(unknown)}")
            models[name] = ModelSpec(
                name=name,
                capabilities=capabilities,
                description=str(raw.get("description", "")),
                windows_format=raw.get("windows_format"),
                server_format=raw.get("server_format"),
            )
        aliases = {str(key): str(value) for key, value in payload.get("aliases", {}).items()}
        return cls(models, aliases)

    def resolve_alias(self, model: str) -> str:
        seen: set[str] = set()
        current = model
        while current in self.aliases and current not in seen:
            seen.add(current)
            current = self.aliases[current]
        return current

    def get(self, model: str) -> ModelSpec | None:
        return self.models.get(self.resolve_alias(model))

    def public_dict(self) -> dict[str, object]:
        return {
            "models": {
                name: {
                    "capabilities": sorted(spec.capabilities),
                    "description": spec.description,
                    "windows_format": spec.windows_format,
                    "server_format": spec.server_format,
                }
                for name, spec in self.models.items()
            },
            "aliases": dict(self.aliases),
        }
