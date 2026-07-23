"""
Chat router — message history and AI streaming.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.base import ChatMessage, User
from app.schemas import ChatMessageCreate, ChatMessageResponse
from app.services.auth import require_admin

router = APIRouter()


@router.get("/messages", response_model=list[ChatMessageResponse])
def list_messages(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ChatMessage).order_by(desc(ChatMessage.created_at)).limit(limit).all()


@router.post("/messages", response_model=ChatMessageResponse)
def create_message(data: ChatMessageCreate, db: Session = Depends(get_db)):
    msg = ChatMessage(**data.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/chat")
def chat_stream(data: ChatMessageCreate):
    async def _stream():
        response_text = (
            "Hola! Soy tu asistente de Bitacora. "
            "Para usar el chat, configura un proveedor de IA en la seccion Configuracion."
        )
        for char in response_text:
            yield char
    
    return StreamingResponse(_stream(), media_type="text/plain")


@router.delete("/messages")
def clear_history(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    db.query(ChatMessage).delete()
    db.commit()
    return {"ok": True}
