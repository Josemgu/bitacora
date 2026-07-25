"""Secret-at-rest encryption helpers for hosted mode."""

from __future__ import annotations

import os

from cryptography.fernet import Fernet

MASTER_KEY_ENV_VAR = "BITACORA_MASTER_KEY"


def _load_master_key() -> bytes:
    raw_key = os.getenv(MASTER_KEY_ENV_VAR, "").strip()
    if not raw_key:
        raise ValueError(f"Missing required environment variable: {MASTER_KEY_ENV_VAR}")
    return raw_key.encode("utf-8")


def _get_fernet() -> Fernet:
    return Fernet(_load_master_key())


def encrypt_secret(plain_text: str) -> bytes:
    """Encrypt plain text using Fernet and return cipher bytes."""
    if not plain_text:
        raise ValueError("Cannot encrypt empty secret")
    return _get_fernet().encrypt(plain_text.encode("utf-8"))


def decrypt_secret(cipher_text: bytes) -> str:
    """Decrypt Fernet cipher bytes and return UTF-8 string."""
    if not cipher_text:
        raise ValueError("Cannot decrypt empty cipher text")
    return _get_fernet().decrypt(cipher_text).decode("utf-8")
