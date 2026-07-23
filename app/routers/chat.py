"""
Chat router — message history + real AI conversation.

POST /chat sends the user message to the active AI provider (the "professor"),
persists both sides of the conversation, and returns the assistant reply as
JSON. If no provider is configured (or the call fails) it degrades to a clear
Spanish error message instead of a fake canned stream.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.base import ChatMessage, User
from app.schemas import ChatMessageCreate, ChatMessageResponse
from app.services.auth import require_admin

router = APIRouter()


@router.get("/messages", response_model=list[ChatMessageResponse])
def list_messages(limit: int = 100, db: Session = Depends(get_db)):
    msgs = db.query(ChatMessage).order_by(desc(ChatMessage.created_at)).limit(limit).all()
    return list(reversed(msgs))


@router.post("/messages", response_model=ChatMessageResponse)
def create_message(data: ChatMessageCreate, db: Session = Depends(get_db)):
    msg = ChatMessage(**data.model_dump())
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.post("/chat")
def chat_with_ai(data: ChatMessageCreate, db: Session = Depends(get_db)):
    """Send a message to the AI professor and get the reply.

    Returns {"reply": str, "user_message_id": int, "assistant_message_id": int}.
    """
    from app.routers.providers import get_active_provider
    from app.services.ai import AIServiceError, chat_reply

    provider = get_active_provider(db)
    if not provider:
        raise HTTPException(
            400,
            "No hay un proveedor de IA activo. Configúralo en la sección Config.",
        )

    # Persist the user's message first so history survives provider errors.
    user_msg = ChatMessage(role="user", content=data.content)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Recent history (oldest→newest), excluding the message just saved.
    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.id != user_msg.id)
        .order_by(desc(ChatMessage.created_at))
        .limit(20)
        .all()
    )
    history = [
        {"role": m.role if m.role in ("user", "assistant") else "user", "content": m.content}
        for m in reversed(recent)
    ]

    # Roadmap context for the professor.
    context = _build_context(db)

    try:
        reply = chat_reply(provider, history, data.content, context=context)
    except AIServiceError as e:
        raise HTTPException(502, str(e))

    assistant_msg = ChatMessage(role="assistant", content=reply)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return {
        "reply": reply,
        "user_message_id": user_msg.id,
        "assistant_message_id": assistant_msg.id,
    }


def _build_context(db: Session) -> str:
    """Small textual summary of the active roadmap for the AI professor."""
    from app.models.base import ItemStatus, Phase, Roadmap

    roadmap = db.query(Roadmap).filter(Roadmap.is_active == True).first()
    if not roadmap:
        return ""
    lines = [f"Roadmap activo: {roadmap.title}"]
    phases = (
        db.query(Phase)
        .filter(Phase.roadmap_id == roadmap.id)
        .order_by(Phase.index)
        .all()
    )
    for p in phases[:8]:
        done = sum(1 for t in p.topics if t.status == ItemStatus.done)
        current = [t.title for t in p.topics if t.status == ItemStatus.current]
        line = f"- Fase {p.index}: {p.title} ({done}/{len(p.topics)} temas completados)"
        if current:
            line += f" — en curso: {current[0]}"
        lines.append(line)
    return "\n".join(lines)


@router.delete("/messages")
def clear_history(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    db.query(ChatMessage).delete()
    db.commit()
    return {"ok": True}
