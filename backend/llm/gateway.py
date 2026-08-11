"""Stable Chat Completions gateway used by all AI Tutor modules."""

from __future__ import annotations

import logging
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


logger = logging.getLogger(__name__)


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
        fallback_provider: LLMProvider | None = None,
        registry: ModelRegistry | None = None,
    ):
        self.settings = settings
        self.registry = registry or ModelRegistry.load(settings.registry_path)
        self.provider = provider
        self.fallback_provider = fallback_provider
        self._slots = BoundedSemaphore(settings.max_concurrency)

    @staticmethod
    def _openai_provider(
        *,
        api_key: str,
        base_url: str | None,
        timeout_seconds: float,
        max_retries: int,
    ) -> OpenAICompatibleProvider:
        return OpenAICompatibleProvider(
            api_key=api_key,
            base_url=base_url,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
        )

    def _build_provider(self) -> LLMProvider:
        if self.settings.provider == "mock":
            return MockProvider(self.settings.mock_response)
        if not self.settings.api_key:
            key_name = "OPENAI_API_KEY" if self.settings.provider == "openai" else "LLM_API_KEY"
            raise LLMGatewayError(f"Missing {key_name} for the configured LLM provider.", status_code=503)
        return self._openai_provider(
            api_key=self.settings.api_key,
            base_url=self.settings.base_url,
            timeout_seconds=self.settings.timeout_seconds,
            max_retries=self.settings.max_retries,
        )

    def _build_fallback_provider(self) -> LLMProvider:
        if not self.settings.cloud_fallback_enabled or not self.settings.cloud_api_key:
            raise LLMGatewayError("Cloud fallback is not configured.", status_code=503)
        return self._openai_provider(
            api_key=self.settings.cloud_api_key,
            base_url=self.settings.cloud_base_url,
            timeout_seconds=self.settings.timeout_seconds,
            max_retries=self.settings.max_retries,
        )

    def get_provider(self) -> LLMProvider:
        if self.provider is None:
            self.provider = self._build_provider()
        return self.provider

    def get_fallback_provider(self) -> LLMProvider:
        if self.fallback_provider is None:
            self.fallback_provider = self._build_fallback_provider()
        return self.fallback_provider

    def _select_primary_model(self, requested_model: str | None, required: set[str]) -> str | None:
        if self.settings.provider != "openai_compatible":
            if "vision" in required and self.settings.vision_model:
                selected = self.settings.vision_model
            elif "tools" in required and self.settings.tool_model:
                selected = self.settings.tool_model
            else:
                selected = self.settings.default_model or requested_model
            return self.registry.resolve_alias(selected) if selected else None

        # A local deployment is explicitly capability-based. Do not send a
        # legacy cloud model name to the local server when that local role is absent.
        if "vision" in required:
            selected = self.settings.vision_model
        elif "tools" in required:
            selected = self.settings.tool_model or self.settings.default_model
        else:
            selected = self.settings.default_model
        return self.registry.resolve_alias(selected) if selected else None

    def _select_fallback_model(self, required: set[str]) -> str:
        if "vision" in required and self.settings.cloud_vision_model:
            selected = self.settings.cloud_vision_model
        elif "tools" in required and self.settings.cloud_tool_model:
            selected = self.settings.cloud_tool_model
        else:
            selected = self.settings.cloud_default_model
        if not selected:
            raise LLMGatewayError("No cloud fallback model is configured for this request.", status_code=503)
        return selected

    def _missing_capabilities(self, model: str, required: set[str]) -> set[str]:
        if not self.settings.validate_capabilities:
            return set()
        spec = self.registry.get(model)
        if spec is None:
            return set()
        return required - set(spec.capabilities)

    def _select_route(self, requested_model: str | None, required: set[str]) -> tuple[str, str]:
        primary_model = self._select_primary_model(requested_model, required)
        if primary_model:
            missing = self._missing_capabilities(primary_model, required)
            if not missing:
                return "primary", primary_model
            if not self.settings.cloud_fallback_enabled:
                raise LLMGatewayError(
                    f"Model {primary_model!r} does not declare required capabilities: "
                    f"{', '.join(sorted(missing))}. Update the local model configuration or enable cloud fallback.",
                    status_code=503,
                )

        if self.settings.cloud_fallback_enabled:
            return "fallback", self._select_fallback_model(required)

        if self.settings.provider == "openai_compatible":
            role = "vision" if "vision" in required else "tool" if "tools" in required else "text"
            raise LLMGatewayError(
                f"No local {role} model is configured and cloud fallback is disabled.",
                status_code=503,
            )
        raise LLMGatewayError(
            "No model was supplied. Set LLM_MODEL or pass model= to create_chat_completion.",
            status_code=503,
        )

    @staticmethod
    def _should_runtime_fallback(exc: OpenAIError) -> bool:
        if isinstance(exc, (APIConnectionError, APITimeoutError, NotFoundError, RateLimitError)):
            return True
        return isinstance(exc, APIStatusError) and exc.status_code >= 500

    @staticmethod
    def _raise_provider_error(exc: OpenAIError, *, model: str, backend: str) -> None:
        if isinstance(exc, AuthenticationError):
            raise LLMGatewayError("LLM authentication failed. Check the configured API key.", status_code=503) from exc
        if isinstance(exc, RateLimitError):
            raise LLMGatewayError("LLM provider rate limit or capacity limit reached.", status_code=429) from exc
        if isinstance(exc, APITimeoutError):
            raise LLMGatewayError("LLM request timed out.", status_code=504) from exc
        if isinstance(exc, APIConnectionError):
            raise LLMGatewayError("LLM provider is unreachable.", status_code=503) from exc
        if isinstance(exc, NotFoundError):
            raise LLMGatewayError(f"LLM model {model!r} was not found by the provider.", status_code=503) from exc
        if isinstance(exc, BadRequestError):
            raise LLMGatewayError("LLM provider rejected the request as incompatible.", status_code=422) from exc
        if isinstance(exc, APIStatusError):
            raise LLMGatewayError(f"LLM provider returned HTTP {exc.status_code}.", status_code=502) from exc
        raise LLMGatewayError(
            f"LLM request failed via {backend}: {exc.__class__.__name__}",
            status_code=502,
        ) from exc

    @staticmethod
    def _declared_capabilities(request: dict[str, Any]) -> set[str]:
        declared = request.pop("required_capabilities", None)
        required = detect_required_capabilities(request)
        if declared is None:
            return required
        if isinstance(declared, str):
            declared = {declared}
        try:
            declared_set = {str(item).lower() for item in declared}
        except TypeError as exc:
            raise LLMGatewayError(
                "required_capabilities must be a string or iterable of strings.",
                status_code=422,
            ) from exc
        unknown = declared_set - KNOWN_CAPABILITIES
        if unknown:
            raise LLMGatewayError(
                f"Unknown required capabilities: {', '.join(sorted(unknown))}.",
                status_code=422,
            )
        return required | declared_set

    def create_chat_completion(self, **kwargs: Any) -> Any:
        request = dict(kwargs)
        required = self._declared_capabilities(request)
        route, model = self._select_route(request.get("model"), required)
        request["model"] = model
        request.setdefault("timeout", self.settings.timeout_seconds)
        acquired = self._slots.acquire(timeout=self.settings.queue_timeout_seconds)
        if not acquired:
            raise LLMGatewayError("LLM request queue is full. Try again later.", status_code=503)
        try:
            provider = self.get_fallback_provider() if route == "fallback" else self.get_provider()
            try:
                return provider.create_chat_completion(**request)
            except OpenAIError as primary_exc:
                if (
                    route == "primary"
                    and self.settings.cloud_fallback_enabled
                    and self._should_runtime_fallback(primary_exc)
                ):
                    fallback_model = self._select_fallback_model(required)
                    fallback_request = dict(request, model=fallback_model)
                    logger.warning(
                        "Local LLM request failed; using cloud fallback "
                        "(local_model=%s, cloud_model=%s, error=%s)",
                        model,
                        fallback_model,
                        primary_exc.__class__.__name__,
                    )
                    try:
                        return self.get_fallback_provider().create_chat_completion(**fallback_request)
                    except OpenAIError as fallback_exc:
                        self._raise_provider_error(
                            fallback_exc,
                            model=fallback_model,
                            backend="cloud_fallback",
                        )
                self._raise_provider_error(primary_exc, model=model, backend=self.settings.backend)
        finally:
            self._slots.release()

    def _routing_summary(self) -> dict[str, dict[str, Any]]:
        if self.settings.provider != "openai_compatible":
            return {}
        profiles = {
            "text": {"text"},
            "json": {"text", "json"},
            "tools": {"text", "tools"},
            "vision": {"text", "vision"},
            "vision_tools_json": {"text", "vision", "tools", "json"},
        }
        summary: dict[str, dict[str, Any]] = {}
        for name, required in profiles.items():
            try:
                route, model = self._select_route(None, required)
            except LLMGatewayError as exc:
                summary[name] = {"route": "unavailable", "error": str(exc)}
            else:
                summary[name] = {"route": route, "model": model}
        return summary

    def health(self, *, check_remote: bool = False) -> dict[str, Any]:
        result: dict[str, Any] = {
            "status": "configured",
            "config": self.settings.public_dict(),
            "registry": self.registry.public_dict(),
        }
        routing = self._routing_summary()
        if routing:
            result["routing"] = routing
        if not check_remote:
            if routing:
                configured_roles = [item.get("route") != "unavailable" for item in routing.values()]
                if not any(configured_roles):
                    result["status"] = "misconfigured"
                elif not all(configured_roles):
                    result["status"] = "partial"
            return result

        primary_remote: dict[str, Any]
        try:
            primary_remote = self.get_provider().health()
        except Exception as exc:
            primary_remote = {"reachable": False, "error": exc.__class__.__name__}
        result["remote"] = primary_remote

        fallback_remote: dict[str, Any] | None = None
        if self.settings.cloud_fallback_enabled:
            try:
                fallback_remote = self.get_fallback_provider().health()
            except Exception as exc:
                fallback_remote = {"reachable": False, "error": exc.__class__.__name__}
            result["fallback_remote"] = fallback_remote

        primary_ready = bool(primary_remote.get("reachable"))
        fallback_ready = bool(fallback_remote and fallback_remote.get("reachable"))
        if not routing:
            result["status"] = "ready" if primary_ready else "unreachable"
            return result

        states: list[bool] = []
        uses_fallback = False
        for item in routing.values():
            route = item.get("route")
            if route == "primary":
                if primary_ready:
                    states.append(True)
                elif self.settings.cloud_fallback_enabled and fallback_ready:
                    uses_fallback = True
                    states.append(True)
                else:
                    states.append(False)
            elif route == "fallback":
                uses_fallback = True
                states.append(fallback_ready)
            else:
                states.append(False)
        if all(states):
            result["status"] = "degraded" if uses_fallback else "ready"
        elif any(states):
            result["status"] = "partial"
        else:
            result["status"] = "unreachable"
        return result


@lru_cache(maxsize=1)
def get_llm_gateway() -> LLMGateway:
    return LLMGateway(LLMSettings.from_env())
