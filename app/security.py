"""
Security utilities for API key encryption/decryption.
Uses Fernet (AES-128-GCM) for symmetric encryption.
"""
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings


def _get_fernet() -> Fernet:
    """
    Create a Fernet instance from the ENCRYPTION_KEY setting.
    The key must be a base64-encoded 32-byte key.
    """
    settings = get_settings()
    if not settings.ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY is not configured. Required for hosted mode.")
    
    # Decode the base64 key
    key_bytes = base64.b64decode(settings.ENCRYPTION_KEY)
    if len(key_bytes) != 32:
        raise ValueError("ENCRYPTION_KEY must be 32 bytes (base64-encoded)")
    
    # Fernet expects a 32-byte key encoded in base64
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_api_key(api_key: str) -> str:
    """
    Encrypt an API key using Fernet.
    
    Args:
        api_key: Plain text API key to encrypt
        
    Returns:
        Base64-encoded encrypted token (Fernet format)
    """
    if not api_key:
        raise ValueError("Cannot encrypt empty API key")
    
    fernet = _get_fernet()
    encrypted = fernet.encrypt(api_key.encode('utf-8'))
    return encrypted.decode('utf-8')


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Decrypt an API key using Fernet.
    
    Args:
        encrypted_key: Base64-encoded encrypted token (Fernet format)
        
    Returns:
        Decrypted plain text API key
    """
    if not encrypted_key:
        raise ValueError("Cannot decrypt empty key")
    
    fernet = _get_fernet()
    decrypted = fernet.decrypt(encrypted_key.encode('utf-8'))
    return decrypted.decode('utf-8')


def generate_encryption_key() -> str:
    """
    Generate a new base64-encoded 32-byte encryption key.
    Use this to create ENCRYPTION_KEY for .env file.
    
    Returns:
        Base64-encoded 32-byte key
    """
    import os
    return base64.b64encode(os.urandom(32)).decode('utf-8')