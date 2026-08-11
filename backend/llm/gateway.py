"""Stable Chat Completions gateway used by all AI Tutor modules."""

from __future__ import annotations

from functools import lru_cache
from threading import BoundedSemaphore
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    OpenAIError,
    RateLimitError,
)

from .capabilities import KNOWN_CAPABILITIES, ModelRegistry, required_capabilities as detect_required_capabilities
from .config import LLMSettings
from .providers import MockProvider, OpenAICompatibleProvider
from .providers.base import LLMProvider


class LLMGatewayError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class LLMGateway:
    def __init__(
        self,
        settings: LLMSettings,
        *,
        provider: LLMProvider | None = None,
        registry: ModelRegistry | None = None,
    ):
        self.settings = settings
        self.registry = registry or ModelRegistry.load(settings.registry_path)
        self.provider = provider
        self._slots = BoundedSemaphore(settings.max_concurrency)

    def _build_provider(self) -> LLMProvider:
        if self.settings.provider == "mock":
            return MockProvider(self.settings.mock_response)
        if not self.settings.api_key:
            key_name = "OPENAI_API_KEY" if self.settings.provider == "openai" else "LLM_API_KEY"
            raise LLMGatewayError(f"Missing {key_name} for the configured LLM provider.", status_code=503)
        return OpenAICompatibleProvider(
            api_key=self.settings.api_key,
            base_url=self.settings.base_url,
            timeout_seconds=self.settings.timeout_seconds,
            max_retries=self.settings.max_retries,
        )

    def get_provider(self) -> LLMProvider:
        if self.provider is None:
            self.provider = self._build_provider()
        return self.provider

    def _select_model(self, requested_model: str | None, required: set[str]) -> str:
        if "vision" in required and self.settings.vision_model:
            selected = self.settings.vision_model
        elif "tools" in required and self.settings.tool_model:
            selected = self.settings.tool_model
        else:
            selected = self.settings.default_model or requested_model
        if not selected:
            raise LLMGatewayError(
                "No model was supplied. Set LLM_MODEL or pass model= to create_chat_completion.",
                status_code=503,
            )
        return self.registry.resolve_alias(selected)

    def _validate_model(self, model: str, required: set[str]) -> None:
        if not self.settings.validate_capabilities:
            return
        spec = self.registry.get(model)
        if spec is None:
            return
        missing = required - set(spec.capabilities)
        if missing:
            raise LLMGatewayError(
                f"Model {model!r} does not declare required capabilities: {', '.join(sorted(missing))}. "
                "Update LLM_MODEL/LLM_VISION_MODEL/LLM_TOOL_MODEL or model_registry.json.",
                status_code=503,
            )

    def create_chat_completion(self, **kwargs: Any) -> Any:
        request = dict(kwargs)
        declared = request.pop("required_capabilities", None)
        required = detect_required_capabilities(request)
        if declared is not None:
            if isinstance(declared, str):
                declared = {declared}
            try:
                declared_set = {str(item).lower() for item in declared}
            except TypeError as exc:
                raise LLMGatewayError("required_capabilities must be a string or iterable of strings.", status_code=422) from exc
            unknown = declared_set - KNOWN_CAPABILITIES
            if unknown:
                raise LLMGatewayError(
                    f"Unknown required capabilities: {', '.join(sorted(unknown))}.",
                    status_code=422,
                )
            required.update(declared_set)
        model = self._select_model(request.get("model"), required)
        self._validate_model(model, required)
        request["model"] = model
        request.setdefault("timeout", self.settings.timeout_seconds)
        acquired = self._slots.acquire(timeout=self.settings.queue_timeout_seconds)
        if not acquired:
            raise LLMGatewayError(
                "LLM request queue is full. Try again later.",
                status_code=503,
            )
        try:
            return self.get_provider().create_chat_completion(**request)
        except AuthenticationError as exc:
            raise LLMGatewayError("LLM authentication failed. Check the configured API key.", status_code=503) from exc
        except RateLimitError as exc:
            raise LLMGatewayError("LLM provider rate limit or capacity limit reached.", status_code=429) from exc
        except APITimeoutError as exc:
            raise LLMGatewayError("LLM request timed out.", status_code=504) from exc
        except APIConnectionError as exc:
            raise LLMGatewayError("LLM provider is unreachable.", status_code=503) from exc
        except NotFoundError as exc:
            raise LLMGatewayError(f"LLM model {model!r} was not found by the provider.", status_code=503) from exc
        except BadRequestError as exc:
            raise LLMGatewayError("LLM provider rejected the request as incompatible.", status_code=422) from exc
        except APIStatusError as exc:
            raise LLMGatewayError(
                f"LLM provider returned HTTP {exc.status_code}.",
                status_code=502,
            ) from exc
        except OpenAIError as exc:
            raise LLMGatewayError(
                f"LLM request failed via {self.settings.backend}: {exc.__class__.__name__}",
                status_code=502,
            ) from exc
        finally:
            self._slots.release()

    def health(self, *, check_remote: bool = False) -> dict[str, Any]:
        result: dict[str, Any] = {
            "status": "configured",
            "config": self.settings.public_dict(),
            "registry": self.registry.public_dict(),
        }
        if not check_remote:
            return result
        try:
            remote = self.get_provider().health()
        except Exception as exc:
            result["status"] = "unreachable"
            result["remote"] = {
                "reachable": False,
                "error": exc.__class__.__name__,
            }
        else:
            result["status"] = "ready" if remote.get("reachable") else "unreachable"
            result["remote"] = remote
        return result


@lru_cache(maxsize=1)
def get_llm_gateway() -> LLMGateway:
    return LLMGateway(LLMSettings.from_env())
