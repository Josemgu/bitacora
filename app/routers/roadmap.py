"""
Roadmap router — Full CRUD for 3-level roadmap (phases → topics → subtopics).
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.base import (
    Phase, Topic, Subtopic, Roadmap, Career, RoadmapSource, ItemStatus,
    Project, ProjectChecklistItem,
    ResourceCategory, Resource, ResourceOrigin, LinkStatus,
    SubtopicResource, ProjectStatus,
)
from app.schemas import (
    PhaseCreate, PhaseResponse, PhaseBase,
    TopicCreate, TopicResponse, TopicBase,
    SubtopicCreate, SubtopicResponse, SubtopicBase,
    SubtopicResourceBase, SubtopicResourceResponse,
    ProjectCreate, ProjectResponse, ProjectBase,
    ProjectChecklistItemBase, ProjectChecklistItemResponse,
    RoadmapResponse,
)
from backend.security.rate_limit import limiter, ai_limit
from backend.schemas.roadmap_import import ImportErrorResponse, ImportSuccessResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["roadmap"])


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────

def get_active_roadmap(db: Session) -> Roadmap:
    """Get the active roadmap, or create a default one."""
    roadmap = db.query(Roadmap).filter(Roadmap.is_active == True).first()
    if not roadmap:
        roadmap = Roadmap(title="Bitácora Learning OS", is_active=True, source="manual")
        db.add(roadmap)
        db.commit()
        db.refresh(roadmap)
        # Create default resource categories
        default_cats = [
            {"slug": "docs", "label": "Documentación", "icon": "📄"},
            {"slug": "video", "label": "Videos", "icon": "🎬"},
            {"slug": "lab", "label": "Labs", "icon": "🧪"},
            {"slug": "article", "label": "Artículos", "icon": "📝"},
            {"slug": "tool", "label": "Herramientas", "icon": "🔧"},
            {"slug": "other", "label": "Otros", "icon": "📦"},
        ]
        for i, cat in enumerate(default_cats):
            rc = ResourceCategory(career_id=roadmap.id, **cat)
            db.add(rc)
        db.commit()
    return roadmap


def recalc_phase_status(db: Session, phase: Phase):
    """Recalculate phase status based on topics."""
    if not phase.topics:
        phase.status = ItemStatus.todo
    elif all(t.status == ItemStatus.done for t in phase.topics):
        phase.status = ItemStatus.done
    elif any(t.status == ItemStatus.done for t in phase.topics):
        phase.status = ItemStatus.current
    else:
        phase.status = ItemStatus.todo


def recalc_topic_status(topic: Topic):
    """Recalculate topic status based on subtopics."""
    if not topic.subtopics:
        return
    if all(s.done for s in topic.subtopics):
        topic.status = ItemStatus.done
    elif any(s.done for s in topic.subtopics):
        topic.status = ItemStatus.current
    else:
        topic.status = ItemStatus.todo


# ──────────────────────────────────────────────────────────────────────
# ROADMAP
# ──────────────────────────────────────────────────────────────────────

@router.get("/")
def get_roadmap(db: Session = Depends(get_db)):
    """Get the active roadmap with full hierarchy."""
    roadmap = get_active_roadmap(db)
    # Eager load phases -> topics -> subtopics
    roadmap = db.query(Roadmap).options(
        joinedload(Roadmap.phases).joinedload(Phase.topics).joinedload(Topic.subtopics)
    ).filter(Roadmap.id == roadmap.id).first()
    return roadmap


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_roadmap(title: str, db: Session = Depends(get_db)):
    """Create a new roadmap and set as active."""
    # Deactivate current
    db.query(Roadmap).filter(Roadmap.is_active == True).update({Roadmap.is_active: False})
    roadmap = Roadmap(title=title, is_active=True, source="manual")
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)
    return roadmap


@router.patch("/{roadmap_id}")
def update_roadmap(roadmap_id: int, title: Optional[str] = None, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    if not roadmap:
        raise HTTPException(404, "Roadmap not found")
    if title is not None:
        roadmap.title = title
    if is_active is not None:
        if is_active:
            db.query(Roadmap).filter(Roadmap.is_active == True).update({Roadmap.is_active: False})
        roadmap.is_active = is_active
    db.commit()
    db.refresh(roadmap)
    return roadmap


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap(roadmap_id: int, db: Session = Depends(get_db)):
    roadmap = db.query(Roadmap).filter(Roadmap.id == roadmap_id).first()
    if not roadmap:
        raise HTTPException(404, "Roadmap not found")
    db.delete(roadmap)
    db.commit()


# ──────────────────────────────────────────────────────────────────────
# PHASES
# ──────────────────────────────────────────────────────────────────────

@router.get("/phases", response_model=List[PhaseResponse])
def list_phases(db: Session = Depends(get_db)):
    roadmap = get_active_roadmap(db)
    phases = db.query(Phase).options(
        joinedload(Phase.topics).joinedload(Topic.subtopics)
    ).filter(Phase.career_id == roadmap.id).order_by(Phase.index).all()
    return phases


@router.post("/phases", response_model=PhaseResponse, status_code=status.HTTP_201_CREATED)
def create_phase(phase: PhaseCreate, db: Session = Depends(get_db)):
    roadmap = get_active_roadmap(db)
    # Auto-assign index if not provided
    max_index = db.query(func.max(Phase.index)).filter(Phase.career_id == roadmap.id).scalar() or -1
    new_phase = Phase(
        career_id=roadmap.id,
        index=phase.index if phase.index is not None else max_index + 1,
        title=phase.title,
        description=phase.description,
        accent=phase.accent,
        status=phase.status,
    )
    db.add(new_phase)
    db.commit()
    db.refresh(new_phase)
    return new_phase


@router.patch("/phases/{phase_id}", response_model=PhaseResponse)
def update_phase(phase_id: int, phase: PhaseBase, db: Session = Depends(get_db)):
    db_phase = db.query(Phase).filter(Phase.id == phase_id).first()
    if not db_phase:
        raise HTTPException(404, "Phase not found")
    if phase.title is not None:
        db_phase.title = phase.title
    if phase.description is not None:
        db_phase.description = phase.description
    if phase.accent is not None:
        db_phase.accent = phase.accent
    if phase.status is not None:
        db_phase.status = ItemStatus(phase.status)
    if phase.index is not None:
        db_phase.index = phase.index
    db.commit()
    db.refresh(db_phase)
    return db_phase


@router.delete("/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phase(phase_id: int, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")
    db.delete(phase)
    db.commit()


@router.post("/phases/reorder")
def reorder_phases(phase_ids: List[int], db: Session = Depends(get_db)):
    """Reorder phases by providing ordered list of phase IDs."""
    for idx, pid in enumerate(phase_ids):
        phase = db.query(Phase).filter(Phase.id == pid).first()
        if phase:
            phase.index = idx
    db.commit()
    return {"status": "ok"}


# ──────────────────────────────────────────────────────────────────────
# TOPICS
# ──────────────────────────────────────────────────────────────────────

@router.get("/phases/{phase_id}/topics", response_model=List[TopicResponse])
def list_topics(phase_id: int, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")
    topics = db.query(Topic).options(
        joinedload(Topic.subtopics)
    ).filter(Topic.phase_id == phase_id).order_by(Topic.order).all()
    return topics


@router.post("/phases/{phase_id}/topics", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
def create_topic(phase_id: int, topic: TopicCreate, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")
    max_order = db.query(func.max(Topic.order)).filter(Topic.phase_id == phase_id).scalar() or -1
    new_topic = Topic(
        phase_id=phase_id,
        title=topic.title,
        order=topic.order if topic.order is not None else max_order + 1,
        status=topic.status,
    )
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    recalc_phase_status(db, phase)
    db.commit()
    return new_topic


@router.patch("/topics/{topic_id}", response_model=TopicResponse)
def update_topic(topic_id: int, topic: TopicBase, db: Session = Depends(get_db)):
    db_topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not db_topic:
        raise HTTPException(404, "Topic not found")
    if topic.title is not None:
        db_topic.title = topic.title
    if topic.order is not None:
        db_topic.order = topic.order
    if topic.status is not None:
        db_topic.status = ItemStatus(topic.status)
    db.commit()
    db.refresh(db_topic)
    recalc_phase_status(db, db_topic.phase)
    db.commit()
    return db_topic


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(404, "Topic not found")
    phase = topic.phase
    db.delete(topic)
    db.commit()
    recalc_phase_status(db, phase)
    db.commit()


@router.post("/topics/reorder")
def reorder_topics(topic_ids: List[int], db: Session = Depends(get_db)):
    """Reorder topics by providing ordered list of topic IDs."""
    for idx, tid in enumerate(topic_ids):
        topic = db.query(Topic).filter(Topic.id == tid).first()
        if topic:
            topic.order = idx
    db.commit()
    return {"status": "ok"}


# ──────────────────────────────────────────────────────────────────────
# SUBTOPICS
# ──────────────────────────────────────────────────────────────────────

@router.get("/topics/{topic_id}/subtopics", response_model=List[SubtopicResponse])
def list_subtopics(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(404, "Topic not found")
    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic_id).order_by(Subtopic.order).all()
    return subtopics


@router.post("/topics/{topic_id}/subtopics", response_model=SubtopicResponse, status_code=status.HTTP_201_CREATED)
def create_subtopic(topic_id: int, subtopic: SubtopicCreate, db: Session = Depends(get_db)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(404, "Topic not found")
    max_order = db.query(func.max(Subtopic.order)).filter(Subtopic.topic_id == topic_id).scalar() or -1
    new_subtopic = Subtopic(
        topic_id=topic_id,
        title=subtopic.title,
        order=subtopic.order if subtopic.order is not None else max_order + 1,
        done=subtopic.done,
        notes=subtopic.notes,
    )
    db.add(new_subtopic)
    db.commit()
    db.refresh(new_subtopic)
    recalc_topic_status(topic)
    recalc_phase_status(db, topic.phase)
    db.commit()
    return new_subtopic


@router.patch("/subtopics/{subtopic_id}", response_model=SubtopicResponse)
def update_subtopic(subtopic_id: int, subtopic: SubtopicBase, db: Session = Depends(get_db)):
    db_subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
    if not db_subtopic:
        raise HTTPException(404, "Subtopic not found")
    if subtopic.title is not None:
        db_subtopic.title = subtopic.title
    if subtopic.order is not None:
        db_subtopic.order = subtopic.order
    if subtopic.done is not None:
        db_subtopic.done = subtopic.done
        if subtopic.done and not db_subtopic.done_at:
            db_subtopic.done_at = datetime.utcnow()
        elif not subtopic.done:
            db_subtopic.done_at = None
    if subtopic.notes is not None:
        db_subtopic.notes = subtopic.notes
    db.commit()
    db.refresh(db_subtopic)
    recalc_topic_status(db_subtopic.topic)
    recalc_phase_status(db, db_subtopic.topic.phase)
    db.commit()
    return db_subtopic


@router.delete("/subtopics/{subtopic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtopic(subtopic_id: int, db: Session = Depends(get_db)):
    subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
    if not subtopic:
        raise HTTPException(404, "Subtopic not found")
    topic = subtopic.topic
    phase = topic.phase
    db.delete(subtopic)
    db.commit()
    recalc_topic_status(topic)
    recalc_phase_status(db, phase)
    db.commit()


@router.post("/subtopics/reorder")
def reorder_subtopics(subtopic_ids: List[int], db: Session = Depends(get_db)):
    """Reorder subtopics by providing ordered list of subtopic IDs."""
    for idx, sid in enumerate(subtopic_ids):
        subtopic = db.query(Subtopic).filter(Subtopic.id == sid).first()
        if subtopic:
            subtopic.order = idx
    db.commit()
    return {"status": "ok"}


@router.post("/subtopics/{subtopic_id}/toggle")
def toggle_subtopic(subtopic_id: int, db: Session = Depends(get_db)):
    """Toggle subtopic done status."""
    subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
    if not subtopic:
        raise HTTPException(404, "Subtopic not found")
    subtopic.done = not subtopic.done
    if subtopic.done:
        subtopic.done_at = datetime.utcnow()
    else:
        subtopic.done_at = None
    db.commit()
    db.refresh(subtopic)
    recalc_topic_status(subtopic.topic)
    recalc_phase_status(db, subtopic.topic.phase)
    db.commit()
    return subtopic


# ──────────────────────────────────────────────────────────────────────
# SUBTOPIC RESOURCES
# ──────────────────────────────────────────────────────────────────────

@router.get("/subtopics/{subtopic_id}/resources", response_model=List[SubtopicResourceResponse])
def list_subtopic_resources(subtopic_id: int, db: Session = Depends(get_db)):
    subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
    if not subtopic:
        raise HTTPException(404, "Subtopic not found")
    resources = db.query(SubtopicResource).filter(SubtopicResource.subtopic_id == subtopic_id).all()
    return resources


@router.post("/subtopics/{subtopic_id}/resources", response_model=SubtopicResourceResponse, status_code=status.HTTP_201_CREATED)
def add_subtopic_resource(subtopic_id: int, resource: SubtopicResourceBase, db: Session = Depends(get_db)):
    subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
    if not subtopic:
        raise HTTPException(404, "Subtopic not found")
    new_resource = SubtopicResource(
        subtopic_id=subtopic_id,
        label=resource.label,
        url=resource.url,
        resource_id=resource.resource_id,
    )
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    return new_resource


@router.delete("/subtopic-resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtopic_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.query(SubtopicResource).filter(SubtopicResource.id == resource_id).first()
    if not resource:
        raise HTTPException(404, "Resource not found")
    db.delete(resource)
    db.commit()


# ──────────────────────────────────────────────────────────────────────
# PROJECTS (GitHub repo linking per phase)
# ──────────────────────────────────────────────────────────────────────

@router.get("/phases/{phase_id}/projects")
def list_projects(phase_id: int, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")
    projects = db.query(Project).filter(Project.phase_id == phase_id).all()
    return projects


@router.post("/phases/{phase_id}/projects", status_code=status.HTTP_201_CREATED)
def create_project(phase_id: int, repo_name: str, repo_url: str = None, description: str = None, db: Session = Depends(get_db)):
    phase = db.query(Phase).filter(Phase.id == phase_id).first()
    if not phase:
        raise HTTPException(404, "Phase not found")
    project = Project(
        phase_id=phase_id,
        repo_name=repo_name,
        repo_url=repo_url,
        description=description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/projects/{project_id}")
def update_project(project_id: int, repo_name: str = None, repo_url: str = None, description: str = None, status: str = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if repo_name is not None:
        project.repo_name = repo_name
    if repo_url is not None:
        project.repo_url = repo_url
    if description is not None:
        project.description = description
    if status is not None:
        project.status = ProjectStatus(status)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/checklist", status_code=status.HTTP_201_CREATED)
def add_checklist_item(project_id: int, label: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    item = ProjectChecklistItem(project_id=project_id, label=label)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/checklist-items/{item_id}")
def update_checklist_item(item_id: int, done: bool = None, label: str = None, db: Session = Depends(get_db)):
    item = db.query(ProjectChecklistItem).filter(ProjectChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
    if done is not None:
        item.done = done
    if label is not None:
        item.label = label
    db.commit()
    db.refresh(item)
    return item


@router.delete("/checklist-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ProjectChecklistItem).filter(ProjectChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
    db.delete(item)
    db.commit()


# ──────────────────────────────────────────────────────────────────────
# IMPORT (MD/JSON)
# ──────────────────────────────────────────────────────────────────────

# Accent palette rotated by phase index so the roadmap isn't monochrome.
_ACCENT_PALETTE = ["#3fb950", "#58a6ff", "#d29922", "#bc8cff", "#f78166"]

# Max upload size: 1 MB (same as parser limit). Validated BEFORE reading
# the full file into memory to avoid RAM exhaustion on large uploads.
_MAX_UPLOAD_BYTES = 1 * 1024 * 1024

# Field length limits — must match the SQLAlchemy model column sizes.
# The parser does NOT validate these; we validate here before persisting.
_MAX_LEN_CAREER_TITLE = 200
_MAX_LEN_PHASE_TITLE = 200
_MAX_LEN_TOPIC_TITLE = 300
_MAX_LEN_SUBTOPIC_TITLE = 400
_MAX_LEN_RESOURCE_LABEL = 200
_MAX_LEN_RESOURCE_URL = 1000


def _validate_field_lengths(parsed) -> None:
    """
    Validate that parsed data fits within DB column sizes.
    Raises HTTPException(400) with a clear message on the first violation.
    Called AFTER parsing but BEFORE the DB transaction.
    """
    title = parsed.title
    if len(title) > _MAX_LEN_CAREER_TITLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"El titulo de la carrera excede {_MAX_LEN_CAREER_TITLE} caracteres "
                f"({len(title)} encontrados). Acorte el titulo."
            ),
        )

    for phase in parsed.phases:
        if len(phase.title) > _MAX_LEN_PHASE_TITLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"El titulo de la fase '{phase.title[:50]}...' excede "
                    f"{_MAX_LEN_PHASE_TITLE} caracteres ({len(phase.title)} encontrados)."
                ),
            )
        for topic in phase.topics:
            if len(topic.title) > _MAX_LEN_TOPIC_TITLE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"El titulo del topic '{topic.title[:50]}...' excede "
                        f"{_MAX_LEN_TOPIC_TITLE} caracteres ({len(topic.title)} encontrados)."
                    ),
                )
            for sub in topic.subtopics:
                if len(sub.title) > _MAX_LEN_SUBTOPIC_TITLE:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"El titulo del subtopic '{sub.title[:50]}...' excede "
                            f"{_MAX_LEN_SUBTOPIC_TITLE} caracteres ({len(sub.title)} encontrados)."
                        ),
                    )
                if sub.resource_label and len(sub.resource_label) > _MAX_LEN_RESOURCE_LABEL:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"La etiqueta del recurso '{sub.resource_label[:50]}...' excede "
                            f"{_MAX_LEN_RESOURCE_LABEL} caracteres."
                        ),
                    )
                if sub.resource_url and len(sub.resource_url) > _MAX_LEN_RESOURCE_URL:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            f"La URL del recurso excede {_MAX_LEN_RESOURCE_URL} caracteres. "
                            f"Use una URL mas corta."
                        ),
                    )


@router.post("/import", response_model=ImportSuccessResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(ai_limit)
def import_roadmap(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Import a roadmap from a user-uploaded .md / .markdown / .json file.

    Flow:
      1. Validate file extension and size (before reading into memory).
      2. Read content and pass to the parser (validates structure).
      3. If parser returns error → 400 with the parser's message.
      4. Validate field lengths against DB column sizes.
      5. If OK → persist entire career in a single transaction.
      6. On any persistence error → full rollback, log traceback, generic 500.
    """
    from backend.services.roadmap_parser import parse_import

    # ── 1. Extension check ──
    filename = file.filename or ""
    name_lower = filename.lower()
    if not (name_lower.endswith(".md") or name_lower.endswith(".markdown") or name_lower.endswith(".json")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Suba un archivo .md, .markdown o .json.",
        )

    # ── 2. Size check BEFORE reading into memory ──
    # FastAPI/Starlette may have already buffered small files, but for
    # large uploads we check content_length up front.  If the header is
    # missing or lying, we fall back to the size check after reading.
    if file.size is not None and file.size > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo excede el limite de {_MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )

    # ── 3. Read and decode ──
    try:
        raw = file.file.read()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo leer el archivo.",
        )

    # Double-check size after read (in case content_length was absent/wrong)
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo excede el limite de {_MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )

    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe estar codificado en UTF-8.",
        )

    # ── 4. Parse (validates MD/JSON structure, NOT field lengths) ──
    parsed, error, warnings = parse_import(content, filename)
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error,
        )

    # ── 5. Validate field lengths BEFORE the DB transaction ──
    _validate_field_lengths(parsed)

    # ── 6. Persist in a single transaction ──
    career = None
    try:
        # Create Career
        career = Career(
            title=parsed.title,
            source=RoadmapSource.md_import,
            source_ref=parsed.source_ref,
            is_active=False,
        )
        db.add(career)
        db.flush()  # assigns career.id without committing

        # Create default resource categories for this career
        default_cats = [
            {"slug": "docs",     "label": "Documentación", "icon": "📄"},
            {"slug": "video",    "label": "Videos",        "icon": "🎬"},
            {"slug": "lab",      "label": "Labs",          "icon": "🧪"},
            {"slug": "article",  "label": "Artículos",     "icon": "📝"},
            {"slug": "tool",     "label": "Herramientas",  "icon": "🔧"},
            {"slug": "other",    "label": "Otros",         "icon": "📦"},
        ]
        for cat in default_cats:
            db.add(ResourceCategory(career_id=career.id, **cat))

        phase_count = 0
        topic_count = 0
        subtopic_count = 0
        resource_count = 0

        for phase_data in parsed.phases:
            phase = Phase(
                career_id=career.id,
                index=phase_data.index,
                title=phase_data.title,
                description=None,
                accent=_ACCENT_PALETTE[phase_data.index % len(_ACCENT_PALETTE)],
                status=ItemStatus.todo,
            )
            db.add(phase)
            db.flush()
            phase_count += 1

            for topic_data in phase_data.topics:
                topic = Topic(
                    phase_id=phase.id,
                    title=topic_data.title,
                    order=topic_data.order,
                    status=ItemStatus.todo,
                )
                db.add(topic)
                db.flush()
                topic_count += 1

                for sub_data in topic_data.subtopics:
                    subtopic = Subtopic(
                        topic_id=topic.id,
                        title=sub_data.title,
                        order=sub_data.order,
                        done=False,
                    )
                    db.add(subtopic)
                    db.flush()
                    subtopic_count += 1

                    # Create SubtopicResource only if parser found a link
                    if sub_data.resource_url:
                        db.add(SubtopicResource(
                            subtopic_id=subtopic.id,
                            label=sub_data.resource_label or sub_data.title,
                            url=sub_data.resource_url,
                            resource_id=None,
                        ))
                        resource_count += 1

        # All entities created — commit the transaction
        db.commit()

    except HTTPException:
        # Re-raise our own HTTPExceptions (validation errors) as-is
        db.rollback()
        raise
    except Exception:
        # Unexpected DB error: rollback everything, log the traceback,
        # return a generic message to the user.
        db.rollback()
        logger.exception("Error inesperado al persistir la importacion del roadmap")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar en la base de datos. La importacion fue cancelada.",
        )

    return ImportSuccessResponse(
        career_id=career.id,
        career_title=career.title,
        phase_count=phase_count,
        topic_count=topic_count,
        subtopic_count=subtopic_count,
        resource_count=resource_count,
        warnings=warnings,
    )


# ──────────────────────────────────────────────────────────────────────
# AI — RESOURCE SUGGESTIONS
# ──────────────────────────────────────────────────────────────────────

class AISuggestResourcesRequest(BaseModel):
    """Request for AI-powered resource suggestions"""
    career_path: str
    phase_titles: List[str]
    topic_titles: List[str]
    provider: Optional[str] = None  # AI provider to use (openai, anthropic, etc.)
    model: Optional[str] = None


class AISuggestResourcesResponse(BaseModel):
    """Response for AI-powered resource suggestions"""
    resources: List[Dict[str, Any]]


@router.post("/ai/suggest-resources", response_model=AISuggestResourcesResponse)
def ai_suggest_resources(request: AISuggestResourcesRequest, db: Session = Depends(get_db)):
    """
    Get AI-powered resource suggestions for a career path and roadmap structure.
    Uses the configured AI provider from the user's settings.
    """
    from app.routers.providers import get_active_provider
    from app.services.ai import generate_resource_suggestions
    
    # Get active AI provider
    provider = get_active_provider(db)
    if not provider:
        raise HTTPException(400, "No active AI provider configured. Please configure an AI provider in settings.")
    
    # Override with request-specific provider if provided
    if request.provider:
        provider = db.query(AIProvider).filter(AIProvider.name == request.provider).first()
        if not provider:
            raise HTTPException(404, f"AI provider '{request.provider}' not found")
    
    # Generate resource suggestions using AI
    try:
        resources = generate_resource_suggestions(
            provider=provider,
            career_path=request.career_path,
            phase_titles=request.phase_titles,
            topic_titles=request.topic_titles,
            model=request.model,
        )
        return {"resources": resources}
    except Exception as e:
        raise HTTPException(500, f"AI resource suggestion failed: {str(e)}")
