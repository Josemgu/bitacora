"""
Application configuration module.
Centralizes all environment variables and settings.
"""
import os
from enum import Enum
from functools import lru_cache
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BitacoraMode(str, Enum):
    """Application operating mode."""
    SELF_HOST = "selfhost"   # User runs locally, keys stay in browser (encrypted in IndexedDB)
    HOSTED = "hosted"        # Hosted service, keys stored server-side (encrypted at rest)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # ──────────────────────────────────────────────────────────────
    # Core Application
    # ──────────────────────────────────────────────────────────────
    APP_NAME: str = "Bitácora"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # ──────────────────────────────────────────────────────────────
    # Operating Mode (CRITICAL for A1)
    # ──────────────────────────────────────────────────────────────
    BITACORA_MODE: BitacoraMode = Field(
        default=BitacoraMode.SELF_HOST,
        description="Operating mode: 'selfhost' (keys in browser) or 'hosted' (keys on server)"
    )
    
    # ──────────────────────────────────────────────────────────────
    # Database
    # ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="sqlite:///./bitacora.db",
        description="SQLAlchemy database URL (sqlite:/// | postgresql:// | mysql://)"
    )
    
    # ──────────────────────────────────────────────────────────────
    # Security (Hosted mode only)
    # ──────────────────────────────────────────────────────────────
    ENCRYPTION_KEY: Optional[str] = Field(
        default=None,
        description="Base64-encoded 32-byte key for encrypting API keys at rest (hosted mode only)"
    )
    
        # ──────────────────────────────────────────────────────────────
    # CORS
    # ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        description="Allowed CORS origins"
    )

    # Accept comma-separated (legacy .env format) or JSON array
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            # Try JSON first
            if v.startswith("["):
                import json
                return json.loads(v)
            # Fallback: comma-separated
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    # ──────────────────────────────────────────────────────────────
    # AI Provider Defaults
    # ──────────────────────────────────────────────────────────────
    DEFAULT_OLLAMA_URL: str = "http://localhost:11434/v1"
    DEFAULT_OPENAI_URL: str = "https://api.openai.com/v1"
    DEFAULT_ANTHROPIC_URL: str = "https://api.anthropic.com"
    
    @property
    def is_self_host(self) -> bool:
        """Check if running in self-host mode."""
        return self.BITACORA_MODE == BitacoraMode.SELF_HOST
    
    @property
    def is_hosted(self) -> bool:
        """Check if running in hosted mode."""
        return self.BITACORA_MODE == BitacoraMode.HOSTED
    
    def validate_encryption_key(self) -> None:
        """Validate encryption key is present and valid for hosted mode."""
        if self.is_hosted:
            if not self.ENCRYPTION_KEY:
                raise ValueError(
                    "ENCRYPTION_KEY is required in hosted mode. "
                    "Generate with: python -c \"import base64, os; print(base64.b64encode(os.urandom(32)).decode())\""
                )
            try:
                import base64
                key_bytes = base64.b64decode(self.ENCRYPTION_KEY)
                if len(key_bytes) != 32:
                    raise ValueError("ENCRYPTION_KEY must be 32 bytes (base64-encoded)")
            except Exception as e:
                raise ValueError(f"Invalid ENCRYPTION_KEY: {e}")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience function for backward compatibility
def get_database_url() -> str:
    """Get database URL from settings."""
    return get_settings().DATABASE_URL


def get_bitacora_mode() -> BitacoraMode:
    """Get current Bitácora mode."""
    return get_settings().BITACORA_MODE