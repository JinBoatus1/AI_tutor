"""Common dependencies: environment, LLM gateway, and helpers."""

import os
import re

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
