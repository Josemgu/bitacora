"""
Security primitives: password hashing, JWT tokens, and symmetric
encryption for secrets at rest.

Password hashing uses PBKDF2-HMAC-SHA256 from the standard library to avoid
native-build compatibility issues; it is a sound choice with a high iteration
count. Tokens use PyJWT. Secret encryption uses Fernet (AES-128-CBC + HMAC).
"""
from __future__ import annotations

import base64
import datetime
import hashlib
import hmac
import secrets
from typing import Any, Optional

import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

# ─── Password hashing (PBKDF2-HMAC-SHA256) ───

_PBKDF2_ROUNDS = 240_000
_PBKDF2_ALGO = "sha256"


def hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash encoded as `pbkdf2_sha256$rounds$salt$hash`."""
    if not password:
        raise ValueError("password must not be empty")
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac(_PBKDF2_ALGO, password.encode("utf-8"), salt, _PBKDF2_ROUNDS)
    return "pbkdf2_sha256${rounds}${salt}${hash}".format(
        rounds=_PBKDF2_ROUNDS,
        salt=base64.b64encode(salt).decode("ascii"),
        hash=base64.b64encode(dk).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verification of a password against a stored hash."""
    try:
        algo, rounds_s, salt_s, hash_s = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        rounds = int(rounds_s)
        salt = base64.b64decode(salt_s)
        expected = base64.b64decode(hash_s)
    except (ValueError, TypeError):
        return False
    dk = hashlib.pbkdf2_hmac(_PBKDF2_ALGO, password.encode("utf-8"), salt, rounds)
    return hmac.compare_digest(dk, expected)


# ─── JWT tokens ───


def _create_token(subject: str, role: str, token_type: str, expires_delta: datetime.timedelta) -> str:
    settings = get_settings()
    now = datetime.datetime.now(datetime.timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject, role, "access",
        datetime.timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject, role, "refresh",
        datetime.timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: Optional[str] = None) -> dict[str, Any]:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    if expected_type is not None and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected token type {expected_type!r}")
    return payload


# ─── Symmetric encryption for secrets at rest ───


def _get_fernet() -> Fernet:
    settings = get_settings()
    if settings.fernet_key:
        key = settings.fernet_key.encode("ascii")
    else:
        # Derive a stable key from the secret key when no dedicated Fernet key
        # is configured. Still requires BITACORA_SECRET_KEY for persistence.
        digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret (e.g. an API key) for storage in the database."""
    if plaintext is None:
        return None
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> Optional[str]:
    """Decrypt a stored secret. Returns None if the value cannot be decrypted."""
    if not ciphertext:
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def generate_fernet_key() -> str:
    """Helper to generate a new Fernet key for BITACORA_FERNET_KEY."""
    return Fernet.generate_key().decode("ascii")
