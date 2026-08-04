"""Common dependencies: environment, LLM gateway, and helpers."""

import os
import re
from typing import Any

from dotenv import load_dotenv
from fastapi import HTTPException
from openai import OpenAI

from llm.gateway import LLMGatewayError, get_llm_gateway

# Load backend/.env first so startup works from either the repo root or backend/.
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path)
load_dotenv()


def clamp_int_0_100(x: str) -> int:
    m = re.search(r"-?\d+", x or "")
    if not m:
        return 50
    value = int(m.group(0))
    return max(0, min(100, value))


def require_openai_client() -> OpenAI:
    """Compatibility helper for callers that still need the underlying SDK client."""
    try:
        provider = get_llm_gateway().get_provider()
    except (LLMGatewayError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"LLM is not configured: {exc}",
        ) from exc
    api_client = getattr(provider, "client", None)
    if api_client is None:
        raise HTTPException(status_code=503, detail="The configured LLM provider has no OpenAI SDK client.")
    return api_client


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
    try:
        return get_llm_gateway().create_chat_completion(**kwargs)
    except (LLMGatewayError, ValueError) as exc:
        status_code = getattr(exc, "status_code", 503)
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


def get_llm_health(*, check_remote: bool = False) -> dict:
    """Return configuration details and optionally probe the inference endpoint."""
    try:
        return get_llm_gateway().health(check_remote=check_remote)
    except (LLMGatewayError, ValueError) as exc:
        return {
            "status": "misconfigured",
            "error": str(exc),
        }
