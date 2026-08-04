"""Environment-driven configuration for local and cloud LLM endpoints."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


SUPPORTED_PROVIDERS = {"openai", "openai_compatible", "mock"}


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().strip('"').strip("'").lstrip("\ufeff").strip()
    return cleaned or None


def _env_bool(name: str, default: bool) -> bool:
    raw = _clean(os.getenv(name))
    if raw is None:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


def _normalize_base_url(value: str | None) -> str | None:
    base_url = _clean(value)
    if not base_url:
        return None
    base_url = base_url.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url += "/v1"
    return base_url


@dataclass(frozen=True)
class LLMSettings:
    provider: str
    backend: str
    base_url: str | None
    api_key: str | None
    default_model: str | None
    vision_model: str | None
    tool_model: str | None
    timeout_seconds: float
    validate_capabilities: bool
    registry_path: Path
    mock_response: str

    @classmethod
    def from_env(cls) -> "LLMSettings":
        base_url = _normalize_base_url(os.getenv("LLM_BASE_URL"))
        configured_provider = _clean(os.getenv("LLM_PROVIDER"))
        provider = (configured_provider or ("openai_compatible" if base_url else "openai")).lower()
        if provider not in SUPPORTED_PROVIDERS:
            choices = ", ".join(sorted(SUPPORTED_PROVIDERS))
            raise ValueError(f"Unsupported LLM_PROVIDER={provider!r}. Expected one of: {choices}.")
        if provider == "openai_compatible" and not base_url:
            raise ValueError("LLM_BASE_URL is required when LLM_PROVIDER=openai_compatible.")
        if provider != "openai_compatible":
            base_url = None

        if provider == "openai":
            api_key = _clean(os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY"))
        else:
            api_key = _clean(os.getenv("LLM_API_KEY")) or "local"

        timeout_raw = _clean(os.getenv("LLM_TIMEOUT_SECONDS")) or "90"
        try:
            timeout_seconds = max(1.0, float(timeout_raw))
        except ValueError as exc:
            raise ValueError("LLM_TIMEOUT_SECONDS must be a number.") from exc

        default_registry = Path(__file__).with_name("model_registry.json")
        registry_path = Path(_clean(os.getenv("LLM_REGISTRY_PATH")) or default_registry).expanduser()

        return cls(
            provider=provider,
            backend=(_clean(os.getenv("LLM_BACKEND")) or provider).lower(),
            base_url=base_url,
            api_key=api_key,
            default_model=_clean(os.getenv("LLM_MODEL")),
            vision_model=_clean(os.getenv("LLM_VISION_MODEL")),
            tool_model=_clean(os.getenv("LLM_TOOL_MODEL")),
            timeout_seconds=timeout_seconds,
            validate_capabilities=_env_bool("LLM_VALIDATE_CAPABILITIES", True),
            registry_path=registry_path,
            mock_response=_clean(os.getenv("LLM_MOCK_RESPONSE")) or "Local LLM mock response.",
        )

    def public_dict(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "backend": self.backend,
            "base_url": self.base_url,
            "default_model": self.default_model,
            "vision_model": self.vision_model,
            "tool_model": self.tool_model,
            "timeout_seconds": self.timeout_seconds,
            "validate_capabilities": self.validate_capabilities,
            "registry_path": str(self.registry_path),
            "api_key_configured": bool(self.api_key),
        }
