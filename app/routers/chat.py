"""
Chat router — message history and AI streaming.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.base import ChatMessage
from app.schemas import ChatMessageCreate, ChatMessageResponse
from backend.security.rate_limit import limiter, ai_limit, standard_limit

router = APIRouter()


@router.get("/messages", response_model=list[ChatMessageResponse])
@limiter.limit(standard_limit)
def list_messages(request: Request, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ChatMessage).order_by(desc(ChatMessage.created_at)).limit(limit).all()


@router.post("/messages", response_model=ChatMessageResponse)
@limiter.limit(ai_limit)
def create_message(request: Request, data: ChatMessageCreate, db: Session = Depends(get_db)):
    msg = ChatMessage(**data.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/chat")
@limiter.limit(ai_limit)
def chat_stream(request: Request, data: ChatMessageCreate):
    async def _stream():
        response_text = (
            "Hola! Soy tu asistente de Bitacora. "
            "Para usar el chat, configura un proveedor de IA en la seccion Configuracion."
        )
        for char in response_text:
            yield char
    
    return StreamingResponse(_stream(), media_type="text/plain")


@router.delete("/messages")
@limiter.limit(standard_limit)
def clear_history(request: Request, db: Session = Depends(get_db)):
    db.query(ChatMessage).delete()
    db.commit()
    return {"ok": True}

