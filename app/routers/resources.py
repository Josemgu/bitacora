"""
Resources router — CRUD for the resource library.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import Resource, ResourceCategory, ResourceQueue, LinkStatus, User
from app.schemas import ResourceCreate, ResourceResponse
from app.services.auth import require_admin
from app.utils.validators import validate_search_query

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
    q = validate_search_query(q)
    if q:
        query = query.filter(Resource.title.ilike(f"%{q}%"))
    return query.limit(500).all()


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
def delete_resource(
    rid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise HTTPException(404, "Resource not found")
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.get("/queue")
def list_queue(db: Session = Depends(get_db)):
    items = db.query(ResourceQueue).order_by(ResourceQueue.created_at.desc()).all()
    return [
        {
            "id": i.id,
            "title": i.title,
            "url": i.url,
            "description": i.description,
            "category_slug": i.category_slug,
            "rationale": i.rationale,
            "found_by": i.found_by,
            "status": i.status.value if hasattr(i.status, "value") else i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
            "reviewed_at": i.reviewed_at.isoformat() if i.reviewed_at else None,
        }
        for i in items
    ]


@router.post("/queue/approve/{qid}")
def approve_queue_item(
    qid: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
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


@router.post("/queue/reject/{qid}")
def reject_queue_item(qid: int, db: Session = Depends(get_db)):
    from datetime import datetime
    item = db.query(ResourceQueue).filter(ResourceQueue.id == qid).first()
    if not item:
        raise HTTPException(404, "Queue item not found")
    item.status = "rejected"
    item.reviewed_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/queue/{qid}")
def delete_queue_item(qid: int, db: Session = Depends(get_db)):
    item = db.query(ResourceQueue).filter(ResourceQueue.id == qid).first()
    if not item:
        raise HTTPException(404, "Queue item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/discover")
def discover_resources(
    q: str,
    max_results: int = 8,
    save_to_queue: bool = True,
    db: Session = Depends(get_db),
):
    """Search the internet for learning resources about a topic.

    Real web search (DuckDuckGo). Optionally stores results in the approval
    queue (skipping URLs already queued or in the library).
    """
    from app.services.websearch import search_learning_resources

    q = validate_search_query(q)
    if not q:
        raise HTTPException(400, "Consulta de búsqueda vacía o inválida")

    results = search_learning_resources(q, max_results=min(max_results, 20))

    queued = 0
    if save_to_queue and results:
        existing_urls = {u for (u,) in db.query(ResourceQueue.url).all()}
        existing_urls |= {u for (u,) in db.query(Resource.url).all()}
        for r in results:
            if r["url"] in existing_urls:
                continue
            db.add(ResourceQueue(
                title=r["title"],
                url=r["url"],
                description=r.get("snippet", ""),
                rationale=f"Encontrado buscando: {q}",
                found_by="websearch",
                status="pending",
            ))
            queued += 1
        db.commit()

    return {"query": q, "results": results, "queued": queued}
