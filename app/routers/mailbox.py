"""
Mailbox router — unified inbox (news, resources, broken links, reminders, suggestions).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.base import MailboxItem, MailboxStatus, MailboxKind
from app.schemas import MailboxItemCreate, MailboxItemResponse

router = APIRouter()


@router.get("", response_model=list[MailboxItemResponse])
def list_items(
    kind: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db)
):
    q = db.query(MailboxItem).order_by(desc(MailboxItem.created_at))
    if kind:
        q = q.filter(MailboxItem.kind == kind)
    if status:
        q = q.filter(MailboxItem.status == status)
    return q.all()


@router.post("", response_model=MailboxItemResponse)
def create_item(data: MailboxItemCreate, db: Session = Depends(get_db)):
    item = MailboxItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{mid}/read")
def mark_read(mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.read
    db.commit()
    return {"ok": True}


@router.patch("/{mid}/approve")
def approve_item(mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.approved
    db.commit()
    return {"ok": True}


@router.patch("/{mid}/reject")
def reject_item(mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.rejected
    db.commit()
    return {"ok": True}


@router.patch("/{mid}/dismiss")
def dismiss_item(mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.dismissed
    db.commit()
    return {"ok": True}


@router.get("/stats/unread")
def unread_count(db: Session = Depends(get_db)):
    count = db.query(MailboxItem).filter(
        MailboxItem.status == MailboxStatus.unread
    ).count()
    return {"unread": count}
