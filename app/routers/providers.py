"""
AI Provider router — configure and test AI providers.
Supports dual-mode: selfhost (keys in browser) and hosted (keys on server).
Per-provider mode: cloud (hosted API) or local (self-hosted/Ollama).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings, BitacoraMode
from app.database import get_db
from app.models.base import AIProvider, ProviderMode
from app.schemas import AIProviderBase, AIProviderResponse
from app.security import encrypt_api_key, decrypt_api_key

router = APIRouter()


@router.get("", response_model=list[AIProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    providers = db.query(AIProvider).all()
    settings = get_settings()
    
    # In selfhost mode, don't return encrypted keys to API
    if settings.BITACORA_MODE == BitacoraMode.SELF_HOST:
        for p in providers:
            p.api_key_encrypted = None
    return providers


@router.post("", response_model=AIProviderResponse)
def create_provider(data: AIProviderBase, db: Session = Depends(get_db)):
    settings = get_settings()
    
    # In selfhost mode, we don't store API keys on server
    # The frontend will store encrypted keys in IndexedDB
    provider_data = data.model_dump()
    
    if settings.BITACORA_MODE == BitacoraMode.HOSTED:
        # Hosted mode: encrypt and store API key if provided
        api_key = provider_data.pop("api_key", None)
        if api_key:
            provider_data["api_key_encrypted"] = encrypt_api_key(api_key)
            provider_data["encryption_version"] = 1
    else:
        # Selfhost mode: don't store API key on server
        provider_data.pop("api_key", None)
        provider_data["api_key_encrypted"] = None
        provider_data["encryption_version"] = None
    
    p = AIProvider(**provider_data)
    db.add(p)
    db.commit()
    db.refresh(p)
    
    # Don't return encrypted key in response
    if settings.BITACORA_MODE == BitacoraMode.SELF_HOST:
        p.api_key_encrypted = None
    return p


@router.patch("/{pid}/activate")
def activate_provider(pid: int, db: Session = Depends(get_db)):
    db.query(AIProvider).update({AIProvider.is_active: False})
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    p.is_active = True
    db.commit()
    return {"ok": True}


@router.delete("/{pid}")
def delete_provider(pid: int, db: Session = Depends(get_db)):
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{pid}/test")
def test_provider(pid: int, db: Session = Depends(get_db)):
    """Test if a provider is configured correctly."""
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    
    settings = get_settings()
    
    if settings.BITACORA_MODE == BitacoraMode.SELF_HOST:
        # In selfhost mode, the key should come from the frontend
        # This endpoint just validates the provider config
        return {
            "ok": True,
            "mode": "selfhost",
            "provider_mode": p.mode.value if p.mode else "cloud",
            "message": "Provider config valid. API key must be provided by frontend."
        }
    else:
        # In hosted mode, decrypt and test the key
        if not p.api_key_encrypted:
            raise HTTPException(400, "No API key configured for this provider")
        
        try:
            api_key = decrypt_api_key(p.api_key_encrypted)
            # Here we could make a test call to the provider
            return {
                "ok": True,
                "mode": "hosted",
                "provider_mode": p.mode.value if p.mode else "cloud",
                "message": "API key decrypted successfully"
            }
        except Exception as e:
            raise HTTPException(400, f"Failed to decrypt API key: {str(e)}")


@router.patch("/{pid}", response_model=AIProviderResponse)
def update_provider(pid: int, data: AIProviderBase, db: Session = Depends(get_db)):
    """Update an AI provider with dual-mode support."""
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    
    settings = get_settings()
    provider_data = data.model_dump(exclude_unset=True)
    
    if settings.BITACORA_MODE == BitacoraMode.HOSTED:
        # Hosted mode: encrypt and store API key if provided
        api_key = provider_data.pop("api_key", None)
        if api_key:
            provider_data["api_key_encrypted"] = encrypt_api_key(api_key)
            provider_data["encryption_version"] = 1
    else:
        # Selfhost mode: don't store API key on server
        provider_data.pop("api_key", None)
        provider_data["api_key_encrypted"] = None
        provider_data["encryption_version"] = None
    
    for key, value in provider_data.items():
        setattr(p, key, value)
    
    db.commit()
    db.refresh(p)
    
    # Don't return encrypted key in response for selfhost mode
    if settings.BITACORA_MODE == BitacoraMode.SELF_HOST:
        p.api_key_encrypted = None
    return p


def get_active_provider(db: Session) -> AIProvider | None:
    """Get the currently active AI provider."""
    return db.query(AIProvider).filter(AIProvider.is_active == True).first()
