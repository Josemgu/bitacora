"""
AI Provider router — configure and test AI providers.

API keys are accepted in plaintext on write, encrypted with Fernet before
storage, and never returned in responses (only a `has_api_key` flag).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import AIProvider, User
from app.schemas import AIProviderCreate, AIProviderResponse
from app.services.auth import require_admin
from app.utils.security import decrypt_secret, encrypt_secret

router = APIRouter()


def get_active_provider(db: Session) -> AIProvider | None:
    """Return the active AI provider, or None. Internal helper (not an endpoint).

    The provider's `api_key_encrypted` field can be decrypted with
    `decrypt_secret()` by callers that need the raw key.
    """
    return db.query(AIProvider).filter(AIProvider.is_active == True).first()


def _to_response(p: AIProvider) -> AIProviderResponse:
    return AIProviderResponse(
        id=p.id,
        name=p.name,
        slug=p.slug,
        endpoint=p.endpoint,
        api_key_env_var=p.api_key_env_var,
        default_model=p.default_model,
        is_local=p.is_local,
        is_active=p.is_active,
        is_instructor=bool(p.is_instructor),
        has_api_key=bool(p.api_key_encrypted),
        created_at=p.created_at,
    )


@router.get("", response_model=list[AIProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    return [_to_response(p) for p in db.query(AIProvider).all()]


@router.post("", response_model=AIProviderResponse)
def create_provider(
    data: AIProviderCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    payload = data.model_dump(exclude={"api_key"})
    p = AIProvider(**payload)
    if data.api_key:
        p.api_key_encrypted = encrypt_secret(data.api_key)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.patch("/{pid}", response_model=AIProviderResponse)
def update_provider(
    pid: int,
    data: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Update provider fields. Accepts api_key (stored encrypted, never returned)."""
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    allowed = {"name", "endpoint", "default_model", "is_local", "api_key_env_var", "is_instructor"}
    for field, value in data.items():
        if field in allowed:
            setattr(p, field, value)
    if data.get("api_key"):
        p.api_key_encrypted = encrypt_secret(str(data["api_key"]))
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.patch("/{pid}/activate")
def activate_provider(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    db.query(AIProvider).update({AIProvider.is_active: False})
    p.is_active = True
    db.commit()
    return {"ok": True}


@router.delete("/{pid}")
def delete_provider(
    pid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    p = db.query(AIProvider).filter(AIProvider.id == pid).first()
    if not p:
        raise HTTPException(404, "Provider not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
