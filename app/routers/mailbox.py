"""
Mailbox router — unified inbox (news, resources, broken links, reminders, suggestions).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.base import MailboxItem, MailboxStatus, MailboxKind
from app.schemas import MailboxItemCreate, MailboxItemResponse
from backend.security.rate_limit import limiter, standard_limit

router = APIRouter()


@router.get("", response_model=list[MailboxItemResponse])
@limiter.limit(standard_limit)
def list_items(
    request: Request,
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
@limiter.limit(standard_limit)
def create_item(request: Request, data: MailboxItemCreate, db: Session = Depends(get_db)):
    item = MailboxItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{mid}/read")
@limiter.limit(standard_limit)
def mark_read(request: Request, mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.read
    db.commit()
    return {"ok": True}


@router.patch("/{mid}/approve")
@limiter.limit(standard_limit)
def approve_item(request: Request, mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.approved
    db.commit()
    return {"ok": True}


@router.patch("/{mid}/reject")
@limiter.limit(standard_limit)
def reject_item(request: Request, mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.rejected
    db.commit()
    return {"ok": True}


@router.patch("/{mid}/dismiss")
@limiter.limit(standard_limit)
def dismiss_item(request: Request, mid: int, db: Session = Depends(get_db)):
    item = db.query(MailboxItem).filter(MailboxItem.id == mid).first()
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = MailboxStatus.dismissed
    db.commit()
    return {"ok": True}


@router.get("/stats/unread")
@limiter.limit(standard_limit)
def unread_count(request: Request, db: Session = Depends(get_db)):
    count = db.query(MailboxItem).filter(
        MailboxItem.status == MailboxStatus.unread
    ).count()
    return {"unread": count}

