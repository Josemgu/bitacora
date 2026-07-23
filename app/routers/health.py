"""
Health check and dashboard stats.
"""
from __future__ import annotations
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.database import get_db
from app.models.base import (
    Phase, Topic, Subtopic, Resource, AIProvider,
    MailboxItem, MailboxStatus, ItemStatus
)
from app.schemas import HealthResponse, DashboardStats

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return HealthResponse(status="ok", db="connected", timestamp=datetime.utcnow())
    except Exception as e:
        return HealthResponse(status="error", db=str(e), timestamp=datetime.utcnow())


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    total_phases = db.query(Phase).count()
    done_phases = db.query(Phase).filter(Phase.status == ItemStatus.done).count()
    total_topics = db.query(Topic).count()
    done_topics = db.query(Topic).filter(Topic.status == ItemStatus.done).count()
    total_subtopics = db.query(Subtopic).count()
    done_subtopics = db.query(Subtopic).filter(Subtopic.done == True).count()
    total_resources = db.query(Resource).count()
    active_providers = db.query(AIProvider).filter(AIProvider.is_active == True).count()
    unread_mailbox = db.query(MailboxItem).filter(MailboxItem.status == MailboxStatus.unread).count()

    return DashboardStats(
        total_phases=total_phases,
        done_phases=done_phases,
        total_topics=total_topics,
        done_topics=done_topics,
        total_subtopics=total_subtopics,
        done_subtopics=done_subtopics,
        total_resources=total_resources,
        active_providers=active_providers,
        unread_mailbox=unread_mailbox,
    )
