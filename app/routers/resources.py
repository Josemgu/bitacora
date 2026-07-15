"""
Resources router — CRUD for the resource library.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import Resource, ResourceCategory, ResourceQueue, LinkStatus
from app.schemas import ResourceCreate, ResourceResponse

router = APIRouter()


@router.get("", response_model=list[ResourceResponse])
def list_resources(
    category_id: int | None = None,
    is_lab: bool | None = None,
    is_tutorial: bool | None = None,
    q: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(Resource)
    if category_id:
        query = query.filter(Resource.category_id == category_id)
    if is_lab is not None:
        query = query.filter(Resource.is_lab == is_lab)
    if is_tutorial is not None:
        query = query.filter(Resource.is_tutorial == is_tutorial)
    if q:
        query = query.filter(Resource.title.ilike(f"%{q}%"))
    return query.all()


@router.post("", response_model=ResourceResponse)
def create_resource(data: ResourceCreate, db: Session = Depends(get_db)):
    r = Resource(**data.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.patch("/{rid}/link-status")
def update_link_status(rid: int, status: str, db: Session = Depends(get_db)):
    from datetime import datetime
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise HTTPException(404, "Resource not found")
    r.link_status = LinkStatus(status)
    r.link_checked_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/{rid}")
def delete_resource(rid: int, db: Session = Depends(get_db)):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise HTTPException(404, "Resource not found")
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.get("/queue", response_model=list[dict])
def list_queue(db: Session = Depends(get_db)):
    return db.query(ResourceQueue).all()


@router.post("/queue/approve/{qid}")
def approve_queue_item(qid: int, db: Session = Depends(get_db)):
    item = db.query(ResourceQueue).filter(ResourceQueue.id == qid).first()
    if not item:
        raise HTTPException(404, "Queue item not found")
    r = Resource(
        title=item.title,
        url=item.url,
        description=item.description,
        origin="ai_discovered",
    )
    db.add(r)
    item.status = "approved"
    from datetime import datetime
    item.reviewed_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "resource_id": r.id}
