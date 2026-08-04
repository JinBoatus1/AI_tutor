"""Common dependencies: environment, OpenAI-compatible client, and helpers."""

import os
import re
from typing import Any

from fastapi import HTTPException
from dotenv import load_dotenv
from openai import AuthenticationError, OpenAI, OpenAIError

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path)
load_dotenv()


def clamp_int_0_100(x: str) -> int:
    m = re.search(r"-?\d+", x or "")
    if not m:
        return 50
    return max(0, min(100, int(m.group(0))))


def _normalize_env(raw: str | None) -> str | None:
    if raw is None:
        return None
    cleaned = raw.strip().strip('"').strip("'").lstrip("\ufeff").strip()
    return cleaned or None


def _positive_float(raw: str | None, default: float) -> float:
    try:
        value = float(raw) if raw is not None else default
    except ValueError:
        return default
    return value if value > 0 else default


# Defaults preserve the existing OpenAI deployment. Setting LLM_BASE_URL enables
# any OpenAI-compatible service (Ollama, vLLM, LM Studio, etc.).
LLM_PROVIDER = (_normalize_env(os.getenv("LLM_PROVIDER")) or "openai").lower()
LLM_BASE_URL = _normalize_env(os.getenv("LLM_BASE_URL"))
LLM_TEXT_MODEL = _normalize_env(os.getenv("LLM_TEXT_MODEL"))
LLM_VISION_MODEL = _normalize_env(os.getenv("LLM_VISION_MODEL")) or LLM_TEXT_MODEL
LLM_TIMEOUT_SECONDS = _positive_float(os.getenv("LLM_TIMEOUT_SECONDS"), 90.0)

_key_candidates = (
    ("LLM_API_KEY", os.getenv("LLM_API_KEY")),
    ("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY")),
    ("API_KEY", os.getenv("API_KEY")),
)
API_KEY_SOURCE, API_KEY = next(
    ((name, value) for name, raw in _key_candidates if (value := _normalize_env(raw))),
    (None, None),
)

# Local OpenAI-compatible servers commonly require a syntactically present key
# but do not authenticate it. Only supply the placeholder when a custom endpoint
# has explicitly been configured; the OpenAI default still requires a real key.
if API_KEY is None and LLM_BASE_URL:
    API_KEY = "local-llm"
    API_KEY_SOURCE = "local-placeholder"

MASKED_KEY = (
    f"{API_KEY[:7]}...{API_KEY[-4:]}"
    if API_KEY and len(API_KEY) >= 12 and API_KEY_SOURCE != "local-placeholder"
    else "<configured>" if API_KEY else "<missing>"
)


def _build_client() -> OpenAI | None:
    if not API_KEY:
        return None
    kwargs: dict[str, Any] = {"api_key": API_KEY}
    if LLM_BASE_URL:
        kwargs["base_url"] = LLM_BASE_URL.rstrip("/") + "/"
    return OpenAI(**kwargs)


client = _build_client()


def require_openai_client() -> OpenAI:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Missing LLM_API_KEY/OPENAI_API_KEY. Set OPENAI_API_KEY for the "
                "default OpenAI provider, or configure LLM_BASE_URL for a local provider."
            ),
        )
    return client


def _messages_contain_image(messages: Any) -> bool:
    if not isinstance(messages, list):
        return False
    for message in messages:
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        if any(isinstance(item, dict) and item.get("type") == "image_url" for item in content):
            return True
    return False


def resolve_llm_model(requested_model: str | None, messages: Any) -> str | None:
    """Apply configured model aliases while preserving existing defaults."""
    if _messages_contain_image(messages) and LLM_VISION_MODEL:
        return LLM_VISION_MODEL
    if LLM_TEXT_MODEL:
        return LLM_TEXT_MODEL
    return requested_model


def get_llm_status() -> dict[str, Any]:
    """Return non-secret configuration data for diagnostics."""
    return {
        "provider": LLM_PROVIDER,
        "base_url": LLM_BASE_URL or "https://api.openai.com/v1",
        "text_model_override": LLM_TEXT_MODEL,
        "vision_model_override": LLM_VISION_MODEL,
        "api_key_configured": bool(API_KEY),
        "api_key_source": API_KEY_SOURCE,
        "timeout_seconds": LLM_TIMEOUT_SECONDS,
    }


def create_chat_completion(**kwargs):
    api_client = require_openai_client()
    kwargs["model"] = resolve_llm_model(kwargs.get("model"), kwargs.get("messages"))
    kwargs.setdefault("timeout", LLM_TIMEOUT_SECONDS)
    try:
        return api_client.chat.completions.create(**kwargs)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                f"LLM authentication failed. provider={LLM_PROVIDER}, "
                f"source={API_KEY_SOURCE or 'none'}, key={MASKED_KEY}."
            ),
        ) from exc
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM request failed: {exc.__class__.__name__}",
        ) from exc
