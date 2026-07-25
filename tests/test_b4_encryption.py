from __future__ import annotations

from cryptography.fernet import Fernet

from backend.security.encryption import decrypt_secret, encrypt_secret


def test_encrypt_decrypt_secret_roundtrip(monkeypatch) -> None:
    master_key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("BITACORA_MASTER_KEY", master_key)

    original = "sk-openai-university-prod-key-2026"
    cipher = encrypt_secret(original)

    assert isinstance(cipher, bytes)
    assert cipher != original.encode("utf-8")

    recovered = decrypt_secret(cipher)
    assert recovered == original
