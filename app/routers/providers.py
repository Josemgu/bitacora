"""
AI Provider router — configure and test AI providers.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import AIProvider
from app.schemas import AIProviderBase, AIProviderResponse

router = APIRouter()


@router.get("", response_model=list[AIProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    return db.query(AIProvider).all()


@router.post("", response_model=AIProviderResponse)
def create_provider(data: AIProviderBase, db: Session = Depends(get_db)):
    p = AIProvider(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
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
