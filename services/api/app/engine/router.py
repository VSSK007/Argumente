"""Model router: picks the engine for each call and falls back to the offline engine on failure."""

import logging
import os

from .local import LocalEngine

log = logging.getLogger("argumente.engine")


def _provider_setting() -> str:
    return os.environ.get("ENGINE_PROVIDER", "auto").lower()


def _anthropic_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def engine_status() -> dict:
    setting = _provider_setting()
    use_llm = setting == "anthropic" or (setting == "auto" and _anthropic_configured())
    return {
        "provider": "anthropic" if use_llm else "local",
        "setting": setting,
        "analyze_model": os.environ.get("ENGINE_ANALYZE_MODEL", "claude-sonnet-5-5") if use_llm else None,
        "fast_model": os.environ.get("ENGINE_FAST_MODEL", "claude-haiku-5-5") if use_llm else None,
        "note": None if use_llm else "Offline engine: heuristic analysis. Set ANTHROPIC_API_KEY for full AI analysis.",
    }


class RoutedEngine:
    """Calls the LLM engine when configured; on any EngineError, uses the local engine.

    Each method returns (result, mode) where mode is "anthropic" or "local" (or "local-fallback").
    """

    def __init__(self):
        self.local = LocalEngine()
        self.llm = None
        if engine_status()["provider"] == "anthropic":
            from .anthropic_provider import AnthropicEngine

            self.llm = AnthropicEngine()

    def __getattr__(self, op):
        def call(*args, **kwargs):
            if self.llm is not None:
                from .anthropic_provider import EngineError

                try:
                    return getattr(self.llm, op)(*args, **kwargs), "anthropic"
                except EngineError as e:
                    log.warning("LLM engine failed for %s (%s); falling back to local engine", op, e)
                    return getattr(self.local, op)(*args, **kwargs), "local-fallback"
            return getattr(self.local, op)(*args, **kwargs), "local"

        return call


def get_engine() -> RoutedEngine:
    return RoutedEngine()
