"""Common dependencies: environment, OpenAI client, helpers."""

import os
import re

from fastapi import HTTPException
from dotenv import load_dotenv
from openai import OpenAI, AuthenticationError, OpenAIError

# 从 main.py 同级目录加载 .env，避免从项目根启动时读不到 backend/.env
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path)
load_dotenv()  # 再读当前工作目录的 .env（可选）


def clamp_int_0_100(x: str) -> int:
    m = re.search(r"-?\d+", x or "")
    if not m:
        return 50
    v = int(m.group(0))
    return max(0, min(100, v))


# ================================
# API KEY & CLIENT INIT
# ================================
def _normalize_api_key(raw: str | None) -> str | None:
    """清洗环境变量中的 API Key，去掉引号和 BOM 等异常字符。"""
    if raw is None:
        return None
    cleaned = raw.strip().strip('"').strip("'")
    # Windows UTF-8 文件有时会带 BOM
    if cleaned.startswith("\ufeff"):
        cleaned = cleaned.lstrip("\ufeff")
    cleaned = cleaned.strip()
    return cleaned or None


API_KEY_SOURCE = "OPENAI_API_KEY" if os.getenv("OPENAI_API_KEY") else ("API_KEY" if os.getenv("API_KEY") else None)
API_KEY = _normalize_api_key(os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY"))
MASKED_KEY = f"{API_KEY[:7]}...{API_KEY[-4:]}" if API_KEY and len(API_KEY) >= 12 else "<missing>"
client = OpenAI(api_key=API_KEY) if API_KEY else None


def require_openai_client() -> OpenAI:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Missing OPENAI_API_KEY. Set it in environment or .env before using AI endpoints.",
        )
    return client


def create_chat_completion(**kwargs):
    api_client = require_openai_client()
    try:
        return api_client.chat.completions.create(**kwargs)
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"OpenAI authentication failed. source={API_KEY_SOURCE or 'none'}, key={MASKED_KEY}. Please verify the key is valid and not revoked.",
        ) from exc
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI request failed: {exc.__class__.__name__}",
        ) from exc

