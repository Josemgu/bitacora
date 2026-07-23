"""
Central application configuration.

All secrets and security-sensitive settings are read from environment
variables (never hard-coded). Copy `.env.example` to `.env` and adjust.
"""
from __future__ import annotations

import os
from functools import lru_cache


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    """Runtime settings loaded from environment variables."""

    def __init__(self) -> None:
        # ─── JWT / auth ───
        # SECRET_KEY MUST be set in production. A random per-process key is
        # used as a fallback so tokens simply become invalid on restart
        # instead of falling back to a well-known, guessable value.
        self.secret_key: str = os.environ.get("BITACORA_SECRET_KEY") or os.urandom(32).hex()
        self.jwt_algorithm: str = "HS256"
        self.access_token_expire_minutes: int = int(
            os.environ.get("BITACORA_ACCESS_TOKEN_MINUTES", "60")
        )
        self.refresh_token_expire_days: int = int(
            os.environ.get("BITACORA_REFRESH_TOKEN_DAYS", "7")
        )

        # When false (default), the API stays open so the existing frontend
        # keeps working out of the box. Flip to true to enforce JWT on every
        # protected/admin endpoint.
        self.auth_enabled: bool = os.environ.get(
            "BITACORA_AUTH_ENABLED", "false"
        ).lower() in {"1", "true", "yes", "on"}

        # ─── Fernet key for encrypting stored secrets (API keys) ───
        # Base64 urlsafe 32-byte key. Generated per-process if absent, which
        # means previously encrypted values become unreadable after restart —
        # set BITACORA_FERNET_KEY in any real deployment.
        self.fernet_key: str | None = os.environ.get("BITACORA_FERNET_KEY")

        # ─── CORS ───
        # Comma-separated list of allowed origins. Defaults to localhost only.
        # NEVER default to "*" — that is the vulnerability we are closing.
        self.cors_origins: list[str] = _split_csv(
            os.environ.get("BITACORA_CORS_ORIGINS")
        ) or [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]

        # ─── Rate limiting ───
        self.rate_limit_default: str = os.environ.get(
            "BITACORA_RATE_LIMIT", "120/minute"
        )
        self.rate_limit_auth: str = os.environ.get(
            "BITACORA_RATE_LIMIT_AUTH", "10/minute"
        )

        # ─── Environment ───
        self.environment: str = os.environ.get("BITACORA_ENV", "development")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
