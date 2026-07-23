"""
Roadmap router — Full CRUD for 3-level roadmap (phases → topics → subtopics).
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.base import (
    Phase, Topic, Subtopic, Roadmap, ItemStatus, Project, ProjectChecklistItem,
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
)

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


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
            rc = ResourceCategory(roadmap_id=roadmap.id, **cat)
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
    ).filter(Phase.roadmap_id == roadmap.id).order_by(Phase.index).all()
    return phases


@router.post("/phases", response_model=PhaseResponse, status_code=status.HTTP_201_CREATED)
def create_phase(phase: PhaseCreate, db: Session = Depends(get_db)):
    roadmap = get_active_roadmap(db)
    # Auto-assign index if not provided
    max_index = db.query(func.max(Phase.index)).filter(Phase.roadmap_id == roadmap.id).scalar() or -1
    new_phase = Phase(
        roadmap_id=roadmap.id,
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
# ROADMAP.SH INTEGRATION
# ──────────────────────────────────────────────────────────────────────

class RoadmapShImportRequest(BaseModel):
    """Request to import a roadmap from roadmap.sh"""
    roadmap_id: str  # e.g., "frontend", "backend", "devops", "python", etc.
    career_path: Optional[str] = None  # Optional career path for AI enhancement
    use_ai_enhancement: bool = True  # Whether to use AI to enhance the roadmap


class RoadmapShRoadmapResponse(BaseModel):
    """Response for available roadmap.sh roadmaps"""
    id: str
    title: str
    description: str
    category: str  # "role-based", "skill-based", "project", "best-practice", "guide"
    tags: List[str] = []
    url: str


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


@router.get("/sh/roadmaps", response_model=List[RoadmapShRoadmapResponse])
def list_roadmap_sh_roadmaps():
    """Get list of available roadmap.sh roadmaps (role-based, skill-based, projects, best practices, guides)."""
    # This returns a curated list of known roadmap.sh roadmaps
    # In production, this could be fetched from roadmap.sh API or scraped
    roadmaps = [
        # Role-based roadmaps
        {"id": "frontend", "title": "Frontend Developer", "description": "Complete frontend development roadmap", "category": "role-based", "tags": ["javascript", "react", "vue", "css", "html"], "url": "https://roadmap.sh/frontend"},
        {"id": "backend", "title": "Backend Developer", "description": "Complete backend development roadmap", "category": "role-based", "tags": ["api", "database", "server", "microservices"], "url": "https://roadmap.sh/backend"},
        {"id": "devops", "title": "DevOps Engineer", "description": "Complete DevOps engineering roadmap", "category": "role-based", "tags": ["ci/cd", "kubernetes", "docker", "cloud", "automation"], "url": "https://roadmap.sh/devops"},
        {"id": "fullstack", "title": "Full Stack Developer", "description": "Complete full stack development roadmap", "category": "role-based", "tags": ["frontend", "backend", "database", "deployment"], "url": "https://roadmap.sh/full-stack"},
        {"id": "mobile", "title": "Mobile Developer", "description": "Mobile app development roadmap", "category": "role-based", "tags": ["ios", "android", "flutter", "react-native"], "url": "https://roadmap.sh/mobile"},
        {"id": "data-scientist", "title": "Data Scientist", "description": "Data science and machine learning roadmap", "category": "role-based", "tags": ["python", "ml", "statistics", "visualization"], "url": "https://roadmap.sh/data-scientist"},
        {"id": "ml-engineer", "title": "ML Engineer", "description": "Machine learning engineering roadmap", "category": "role-based", "tags": ["mlops", "tensorflow", "pytorch", "deployment"], "url": "https://roadmap.sh/ml-engineer"},
        {"id": "qa", "title": "QA Engineer", "description": "Quality assurance engineering roadmap", "category": "role-based", "tags": ["testing", "automation", "selenium", "cypress"], "url": "https://roadmap.sh/qa"},
        {"id": "security", "title": "Cyber Security", "description": "Cybersecurity specialist roadmap", "category": "role-based", "tags": ["pentesting", "network-security", "compliance"], "url": "https://roadmap.sh/cyber-security"},
        {"id": "site-reliability", "title": "Site Reliability Engineer", "description": "SRE roadmap", "category": "role-based", "tags": ["monitoring", "incident-response", "scalability"], "url": "https://roadmap.sh/sre"},
        {"id": "software-architect", "title": "Software Architect", "description": "Software architecture roadmap", "category": "role-based", "tags": ["design-patterns", "system-design", "microservices"], "url": "https://roadmap.sh/software-architect"},
        {"id": "engineering-manager", "title": "Engineering Manager", "description": "Engineering management roadmap", "category": "role-based", "tags": ["leadership", "team-management", "strategy"], "url": "https://roadmap.sh/engineering-manager"},
        
        # Skill-based roadmaps
        {"id": "python", "title": "Python Developer", "description": "Python programming roadmap", "category": "skill-based", "tags": ["python", "django", "fastapi", "data-science"], "url": "https://roadmap.sh/python"},
        {"id": "javascript", "title": "JavaScript Developer", "description": "JavaScript programming roadmap", "category": "skill-based", "tags": ["javascript", "typescript", "nodejs", "react"], "url": "https://roadmap.sh/javascript"},
        {"id": "typescript", "title": "TypeScript Developer", "description": "TypeScript programming roadmap", "category": "skill-based", "tags": ["typescript", "type-safety", "angular", "react"], "url": "https://roadmap.sh/typescript"},
        {"id": "go", "title": "Go Developer", "description": "Go programming roadmap", "category": "skill-based", "tags": ["golang", "microservices", "concurrency"], "url": "https://roadmap.sh/go"},
        {"id": "rust", "title": "Rust Developer", "description": "Rust programming roadmap", "category": "skill-based", "tags": ["rust", "systems", "webassembly"], "url": "https://roadmap.sh/rust"},
        {"id": "java", "title": "Java Developer", "description": "Java programming roadmap", "category": "skill-based", "tags": ["java", "spring", "enterprise"], "url": "https://roadmap.sh/java"},
        {"id": "cpp", "title": "C++ Developer", "description": "C++ programming roadmap", "category": "skill-based", "tags": ["cpp", "systems", "game-dev"], "url": "https://roadmap.sh/cpp"},
        {"id": "csharp", "title": "C# Developer", "description": "C# and .NET roadmap", "category": "skill-based", "tags": ["csharp", "dotnet", "azure"], "url": "https://roadmap.sh/csharp"},
        {"id": "php", "title": "PHP Developer", "description": "PHP programming roadmap", "category": "skill-based", "tags": ["php", "laravel", "symfony"], "url": "https://roadmap.sh/php"},
        {"id": "ruby", "title": "Ruby Developer", "description": "Ruby programming roadmap", "category": "skill-based", "tags": ["ruby", "rails", "web-dev"], "url": "https://roadmap.sh/ruby"},
        {"id": "swift", "title": "iOS Developer", "description": "iOS development roadmap", "category": "skill-based", "tags": ["swift", "swiftui", "ios", "apple"], "url": "https://roadmap.sh/ios"},
        {"id": "kotlin", "title": "Android Developer", "description": "Android development roadmap", "category": "skill-based", "tags": ["kotlin", "android", "jetpack-compose"], "url": "https://roadmap.sh/android"},
        {"id": "flutter", "title": "Flutter Developer", "description": "Flutter cross-platform development roadmap", "category": "skill-based", "tags": ["flutter", "dart", "cross-platform"], "url": "https://roadmap.sh/flutter"},
        {"id": "react-native", "title": "React Native Developer", "description": "React Native mobile development roadmap", "category": "skill-based", "tags": ["react-native", "mobile", "javascript"], "url": "https://roadmap.sh/react-native"},
        
        # Cloud & Infrastructure
        {"id": "aws", "title": "AWS Cloud Practitioner", "description": "Amazon Web Services roadmap", "category": "skill-based", "tags": ["aws", "cloud", "certification"], "url": "https://roadmap.sh/aws"},
        {"id": "azure", "title": "Azure Cloud Engineer", "description": "Microsoft Azure roadmap", "category": "skill-based", "tags": ["azure", "cloud", "microsoft"], "url": "https://roadmap.sh/azure"},
        {"id": "gcp", "title": "Google Cloud Engineer", "description": "Google Cloud Platform roadmap", "category": "skill-based", "tags": ["gcp", "cloud", "google"], "url": "https://roadmap.sh/gcp"},
        {"id": "kubernetes", "title": "Kubernetes Administrator", "description": "Kubernetes orchestration roadmap", "category": "skill-based", "tags": ["k8s", "containers", "orchestration"], "url": "https://roadmap.sh/kubernetes"},
        {"id": "docker", "title": "Docker", "description": "Containerization with Docker roadmap", "category": "skill-based", "tags": ["docker", "containers", "devops"], "url": "https://roadmap.sh/docker"},
        {"id": "terraform", "title": "Terraform", "description": "Infrastructure as Code with Terraform", "category": "skill-based", "tags": ["terraform", "iac", "infrastructure"], "url": "https://roadmap.sh/terraform"},
        {"id": "ansible", "title": "Ansible", "description": "Automation with Ansible roadmap", "category": "skill-based", "tags": ["ansible", "automation", "configuration-management"], "url": "https://roadmap.sh/ansible"},
        
        # Databases
        {"id": "postgresql", "title": "PostgreSQL", "description": "PostgreSQL database roadmap", "category": "skill-based", "tags": ["postgresql", "sql", "database"], "url": "https://roadmap.sh/postgresql"},
        {"id": "mongodb", "title": "MongoDB", "description": "MongoDB NoSQL database roadmap", "category": "skill-based", "tags": ["mongodb", "nosql", "database"], "url": "https://roadmap.sh/mongodb"},
        {"id": "redis", "title": "Redis", "description": "Redis in-memory database roadmap", "category": "skill-based", "tags": ["redis", "cache", "database"], "url": "https://roadmap.sh/redis"},
        
        # Project-based roadmaps
        {"id": "project-ecommerce", "title": "E-commerce Platform", "description": "Build a full-stack e-commerce application", "category": "project", "tags": ["fullstack", "payments", "database", "deployment"], "url": "https://roadmap.sh/projects/ecommerce"},
        {"id": "project-task-manager", "title": "Task Manager", "description": "Build a task management application", "category": "project", "tags": ["crud", "auth", "real-time"], "url": "https://roadmap.sh/projects/task-manager"},
        {"id": "project-chat-app", "title": "Real-time Chat App", "description": "Build a real-time chat application", "category": "project", "tags": ["websockets", "real-time", "react"], "url": "https://roadmap.sh/projects/chat-app"},
        {"id": "project-blog", "title": "Blog Platform", "description": "Build a blog platform with CMS features", "category": "project", "tags": ["cms", "content-management", "seo"], "url": "https://roadmap.sh/projects/blog"},
        {"id": "project-portfolio", "title": "Developer Portfolio", "description": "Build a personal portfolio website", "category": "project", "tags": ["portfolio", "showcase", "personal-brand"], "url": "https://roadmap.sh/projects/portfolio"},
        
        # Best practices
        {"id": "best-practices-git", "title": "Git Best Practices", "description": "Version control best practices", "category": "best-practice", "tags": ["git", "version-control", "workflow"], "url": "https://roadmap.sh/best-practices/git"},
        {"id": "best-practices-api", "title": "API Design Best Practices", "description": "RESTful API design guidelines", "category": "best-practice", "tags": ["api", "rest", "design"], "url": "https://roadmap.sh/best-practices/api-design"},
        {"id": "best-practices-testing", "title": "Testing Best Practices", "description": "Software testing strategies", "category": "best-practice", "tags": ["testing", "tdd", "quality"], "url": "https://roadmap.sh/best-practices/testing"},
        {"id": "best-practices-security", "title": "Security Best Practices", "description": "Application security guidelines", "category": "best-practice", "tags": ["security", "owasp", "vulnerabilities"], "url": "https://roadmap.sh/best-practices/security"},
        {"id": "best-practices-performance", "title": "Performance Optimization", "description": "Web performance optimization", "category": "best-practice", "tags": ["performance", "optimization", "web-vitals"], "url": "https://roadmap.sh/best-practices/performance"},
        
        # Guides
        {"id": "guide-system-design", "title": "System Design Guide", "description": "System design interview preparation", "category": "guide", "tags": ["system-design", "architecture", "interview"], "url": "https://roadmap.sh/guides/system-design"},
        {"id": "guide-career", "title": "Career Guide", "description": "Software engineering career guidance", "category": "guide", "tags": ["career", "job-search", "growth"], "url": "https://roadmap.sh/guides/career"},
        {"id": "guide-freelancing", "title": "Freelancing Guide", "description": "Freelance software development guide", "category": "guide", "tags": ["freelance", "business", "clients"], "url": "https://roadmap.sh/guides/freelancing"},
        {"id": "guide-open-source", "title": "Open Source Guide", "description": "Contributing to open source projects", "category": "guide", "tags": ["open-source", "contribution", "github"], "url": "https://roadmap.sh/guides/open-source"},
    ]
    return roadmaps


@router.post("/sh/import", response_model=RoadmapResponse)
def import_roadmap_sh(request: RoadmapShImportRequest, db: Session = Depends(get_db)):
    """
    Import a roadmap from roadmap.sh into Bitácora.
    Fetches the roadmap data, optionally enhances with AI, and creates phases/topics/subtopics.
    """
    import httpx
    import json
    
    # Fetch roadmap.sh data
    roadmap_url = f"https://roadmap.sh/{request.roadmap_id}"
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(roadmap_url)
            response.raise_for_status()
            html_content = response.text
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch roadmap.sh roadmap: {str(e)}")
    
    # Parse the roadmap.sh HTML to extract structured data
    # roadmap.sh uses a specific JSON structure embedded in the page
    roadmap_data = _parse_roadmap_sh_html(html_content, request.roadmap_id)
    
    if not roadmap_data:
        raise HTTPException(404, f"Could not parse roadmap data for {request.roadmap_id}")
    
    # Optionally enhance with AI
    if request.use_ai_enhancement and request.career_path:
        roadmap_data = _enhance_roadmap_with_ai(roadmap_data, request.career_path, db)
    
    # Create new roadmap in Bitácora
    # Deactivate current active roadmap
    db.query(Roadmap).filter(Roadmap.is_active == True).update({Roadmap.is_active: False})
    
    roadmap = Roadmap(
        title=roadmap_data.get("title", f"roadmap.sh - {request.roadmap_id}"),
        is_active=True,
        source="roadmap.sh",
        source_ref=request.roadmap_id,
    )
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
        rc = ResourceCategory(roadmap_id=roadmap.id, **cat)
        db.add(rc)
    db.commit()
    
    # Create phases, topics, subtopics from roadmap.sh data
    for phase_idx, phase_data in enumerate(roadmap_data.get("phases", [])):
        phase = Phase(
            roadmap_id=roadmap.id,
            index=phase_idx,
            title=phase_data.get("title", f"Phase {phase_idx + 1}"),
            description=phase_data.get("description", ""),
            accent=phase_data.get("color", "#3fb950"),
            status=ItemStatus.todo,
        )
        db.add(phase)
        db.commit()
        db.refresh(phase)
        
        for topic_idx, topic_data in enumerate(phase_data.get("topics", [])):
            topic = Topic(
                phase_id=phase.id,
                order=topic_idx,
                title=topic_data.get("title", f"Topic {topic_idx + 1}"),
                status=ItemStatus.todo,
            )
            db.add(topic)
            db.commit()
            db.refresh(topic)
            
            for subtopic_idx, subtopic_data in enumerate(topic_data.get("subtopics", [])):
                subtopic = Subtopic(
                    topic_id=topic.id,
                    order=subtopic_idx,
                    title=subtopic_data.get("title", f"Subtopic {subtopic_idx + 1}"),
                    done=False,
                    notes=subtopic_data.get("description", ""),
                )
                db.add(subtopic)
                db.commit()
                db.refresh(subtopic)
                
                # Add resources if available
                for resource_data in subtopic_data.get("resources", []):
                    subtopic_resource = SubtopicResource(
                        subtopic_id=subtopic.id,
                        label=resource_data.get("label", resource_data.get("title", "Resource")),
                        url=resource_data.get("url", ""),
                    )
                    db.add(subtopic_resource)
                db.commit()
            
            recalc_topic_status(topic)
            recalc_phase_status(db, phase)
            db.commit()
    
    # Return the full roadmap with hierarchy
    roadmap = db.query(Roadmap).options(
        joinedload(Roadmap.phases).joinedload(Phase.topics).joinedload(Topic.subtopics)
    ).filter(Roadmap.id == roadmap.id).first()
    
    return roadmap


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


def _parse_roadmap_sh_html(html_content: str, roadmap_id: str) -> Optional[Dict[str, Any]]:
    """
    Parse roadmap.sh HTML to extract structured roadmap data.
    roadmap.sh embeds roadmap data in a JSON script tag.
    """
    import re
    import json
    
    # Try to find the roadmap data in the HTML
    # roadmap.sh typically embeds data in a script tag with id="roadmap-data" or similar
    patterns = [
        r'<script[^>]*id=["\']roadmap-data["\'][^>]*>(.*?)</script>',
        r'<script[^>]*type=["\']application/json["\'][^>]*>(.*?)</script>',
        r'window\.roadmapData\s*=\s*({.*?});',
        r'roadmapData\s*:\s*({.*?})',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html_content, re.DOTALL)
        for match in matches:
            try:
                data = json.loads(match.strip())
                if data and isinstance(data, dict):
                    return _transform_roadmap_sh_data(data, roadmap_id)
            except json.JSONDecodeError:
                continue
    
    # Fallback: try to extract from meta tags or known structure
    # roadmap.sh uses a specific format - try to find the roadmap JSON
    # Look for the roadmap content in the page
    return _extract_roadmap_from_content(html_content, roadmap_id)


def _transform_roadmap_sh_data(data: Dict[str, Any], roadmap_id: str) -> Dict[str, Any]:
    """Transform roadmap.sh data format to Bitácora format."""
    # roadmap.sh data structure varies, but typically has:
    # { title, description, phases: [{ title, description, color, topics: [{ title, description, resources: [] }] }] }
    
    result = {
        "title": data.get("title", f"roadmap.sh - {roadmap_id}"),
        "description": data.get("description", ""),
        "phases": []
    }
    
    for phase in data.get("phases", []):
        phase_data = {
            "title": phase.get("title", phase.get("name", "Untitled Phase")),
            "description": phase.get("description", ""),
            "color": phase.get("color", phase.get("accent", "#3fb950")),
            "topics": []
        }
        
        for topic in phase.get("topics", []):
            topic_data = {
                "title": topic.get("title", topic.get("name", "Untitled Topic")),
                "description": topic.get("description", ""),
                "subtopics": []
            }
            
            for subtopic in topic.get("subtopics", topic.get("items", [])):
                subtopic_data = {
                    "title": subtopic.get("title", subtopic.get("name", "Untitled Subtopic")),
                    "description": subtopic.get("description", ""),
                    "resources": []
                }
                
                for resource in subtopic.get("resources", subtopic.get("links", [])):
                    subtopic_data["resources"].append({
                        "label": resource.get("label", resource.get("title", "Resource")),
                        "url": resource.get("url", resource.get("link", "")),
                    })
                
                topic_data["subtopics"].append(subtopic_data)
            
            phase_data["topics"].append(topic_data)
        
        result["phases"].append(phase_data)
    
    return result


def _extract_roadmap_from_content(html_content: str, roadmap_id: str) -> Optional[Dict[str, Any]]:
    """
    Fallback extraction when JSON parsing fails.
    Creates a basic structure based on known roadmap.sh roadmaps.
    """
    # Known roadmap structures for popular roadmaps
    known_roadmaps = {
        "frontend": {
            "title": "Frontend Developer Roadmap",
            "phases": [
                {"title": "Fundamentos", "color": "#f7df1e", "topics": [
                    {"title": "HTML", "subtopics": [{"title": "Semantic HTML"}, {"title": "Forms"}, {"title": "Accessibility"}]},
                    {"title": "CSS", "subtopics": [{"title": "Flexbox"}, {"title": "Grid"}, {"title": "Animations"}, {"title": "Responsive Design"}]},
                    {"title": "JavaScript", "subtopics": [{"title": "ES6+"}, {"title": "Async/Await"}, {"title": "DOM Manipulation"}, {"title": "Modules"}]},
                ]},
                {"title": "Frameworks", "color": "#61dafb", "topics": [
                    {"title": "React", "subtopics": [{"title": "Components"}, {"title": "Hooks"}, {"title": "State Management"}, {"title": "Next.js"}]},
                    {"title": "Vue", "subtopics": [{"title": "Composition API"}, {"title": "Pinia"}, {"title": "Nuxt.js"}]},
                    {"title": "TypeScript", "subtopics": [{"title": "Types"}, {"title": "Generics"}, {"title": "Utility Types"}]},
                ]},
                {"title": "Herramientas", "color": "#3fb950", "topics": [
                    {"title": "Build Tools", "subtopics": [{"title": "Vite"}, {"title": "Webpack"}, {"title": "Turbopack"}]},
                    {"title": "Testing", "subtopics": [{"title": "Vitest"}, {"title": "Playwright"}, {"title": "React Testing Library"}]},
                    {"title": "Deployment", "subtopics": [{"title": "Vercel"}, {"title": "Netlify"}, {"title": "Docker"}]},
                ]},
            ]
        },
        "backend": {
            "title": "Backend Developer Roadmap",
            "phases": [
                {"title": "Fundamentos", "color": "#3fb950", "topics": [
                    {"title": "HTTP/REST", "subtopics": [{"title": "Methods"}, {"title": "Status Codes"}, {"title": "Headers"}]},
                    {"title": "Databases", "subtopics": [{"title": "SQL"}, {"title": "NoSQL"}, {"title": "ORMs"}]},
                    {"title": "Caching", "subtopics": [{"title": "Redis"}, {"title": "Memcached"}]},
                ]},
                {"title": "Lenguajes & Frameworks", "color": "#61dafb", "topics": [
                    {"title": "Node.js", "subtopics": [{"title": "Express"}, {"title": "Fastify"}, {"title": "NestJS"}]},
                    {"title": "Python", "subtopics": [{"title": "FastAPI"}, {"title": "Django"}, {"title": "Flask"}]},
                    {"title": "Go", "subtopics": [{"title": "Gin"}, {"title": "Echo"}, {"title": "Standard Library"}]},
                ]},
                {"title": "Arquitectura", "color": "#f7df1e", "topics": [
                    {"title": "Microservices", "subtopics": [{"title": "Service Discovery"}, {"title": "API Gateway"}, {"title": "Event-Driven"}]},
                    {"title": "Message Queues", "subtopics": [{"title": "RabbitMQ"}, {"title": "Kafka"}, {"title": "NATS"}]},
                    {"title": "Observability", "subtopics": [{"title": "Logging"}, {"title": "Metrics"}, {"title": "Tracing"}]},
                ]},
            ]
        },
        "devops": {
            "title": "DevOps Engineer Roadmap",
            "phases": [
                {"title": "Linux & Scripting", "color": "#f7df1e", "topics": [
                    {"title": "Linux Fundamentals", "subtopics": [{"title": "File System"}, {"title": "Permissions"}, {"title": "Process Management"}, {"title": "Shell Scripting"}]},
                    {"title": "Networking", "subtopics": [{"title": "DNS"}, {"title": "HTTP/HTTPS"}, {"title": "Load Balancing"}, {"title": "Firewalls"}]},
                ]},
                {"title": "Containerización", "color": "#2496ed", "topics": [
                    {"title": "Docker", "subtopics": [{"title": "Images"}, {"title": "Dockerfile"}, {"title": "Compose"}, {"title": "Multi-stage Builds"}]},
                    {"title": "Kubernetes", "subtopics": [{"title": "Pods"}, {"title": "Services"}, {"title": "Ingress"}, {"title": "Helm"}]},
                ]},
                {"title": "CI/CD", "color": "#3fb950", "topics": [
                    {"title": "GitHub Actions", "subtopics": [{"title": "Workflows"}, {"title": "Actions"}, {"title": "Secrets"}]},
                    {"title": "GitLab CI", "subtopics": [{"title": "Pipelines"}, {"title": "Runners"}, {"title": "Deployments"}]},
                    {"title": "ArgoCD", "subtopics": [{"title": "GitOps"}, {"title": "Applications"}, {"title": "Sync"}]},
                ]},
                {"title": "Cloud & Infra", "color": "#ff9900", "topics": [
                    {"title": "AWS", "subtopics": [{"title": "EC2"}, {"title": "S3"}, {"title": "RDS"}, {"title": "EKS"}]},
                    {"title": "Terraform", "subtopics": [{"title": "Providers"}, {"title": "Modules"}, {"title": "State Management"}]},
                    {"title": "Monitoring", "subtopics": [{"title": "Prometheus"}, {"title": "Grafana"}, {"title": "Loki"}, {"title": "Alerting"}]},
                ]},
            ]
        },
        "python": {
            "title": "Python Developer Roadmap",
            "phases": [
                {"title": "Fundamentos", "color": "#3776ab", "topics": [
                    {"title": "Python Basics", "subtopics": [{"title": "Syntax"}, {"title": "Data Types"}, {"title": "Control Flow"}, {"title": "Functions"}]},
                    {"title": "OOP", "subtopics": [{"title": "Classes"}, {"title": "Inheritance"}, {"title": "Decorators"}, {"title": "Context Managers"}]},
                    {"title": "Standard Library", "subtopics": [{"title": "pathlib"}, {"title": "asyncio"}, {"title": "dataclasses"}, {"title": "typing"}]},
                ]},
                {"title": "Desarrollo Web", "color": "#009688", "topics": [
                    {"title": "FastAPI", "subtopics": [{"title": "Routing"}, {"title": "Dependency Injection"}, {"title": "Pydantic"}, {"title": "Testing"}]},
                    {"title": "Django", "subtopics": [{"title": "Models"}, {"title": "Views"}, {"title": "ORM"}, {"title": "Admin"}]},
                    {"title": "Database", "subtopics": [{"title": "SQLAlchemy"}, {"title": "Alembic"}, {"title": "PostgreSQL"}, {"title": "Redis"}]},
                ]},
                {"title": "Data & ML", "color": "#ff6f00", "topics": [
                    {"title": "Data Analysis", "subtopics": [{"title": "Pandas"}, {"title": "NumPy"}, {"title": "Visualization"}]},
                    {"title": "Machine Learning", "subtopics": [{"title": "Scikit-learn"}, {"title": "PyTorch"}, {"title": "TensorFlow"}]},
                ]},
            ]
        },
    }
    
    if roadmap_id in known_roadmaps:
        return known_roadmaps[roadmap_id]
    
    # Generic fallback structure
    return {
        "title": f"roadmap.sh - {roadmap_id}",
        "phases": [
            {"title": "Fase 1: Fundamentos", "color": "#3fb950", "topics": [
                {"title": "Tema 1", "subtopics": [{"title": "Subtema 1.1"}, {"title": "Subtema 1.2"}]},
                {"title": "Tema 2", "subtopics": [{"title": "Subtema 2.1"}, {"title": "Subtema 2.2"}]},
            ]},
            {"title": "Fase 2: Avanzado", "color": "#61dafb", "topics": [
                {"title": "Tema 3", "subtopics": [{"title": "Subtema 3.1"}, {"title": "Subtema 3.2"}]},
            ]},
        ]
    }


def _enhance_roadmap_with_ai(roadmap_data: Dict[str, Any], career_path: str, db: Session) -> Dict[str, Any]:
    """
    Enhance roadmap data with AI-generated content based on career path.
    This adds more specific topics, subtopics, and resources tailored to the career.
    """
    from app.routers.providers import get_active_provider
    from app.services.ai import enhance_roadmap_with_ai
    
    provider = get_active_provider(db)
    if not provider:
        return roadmap_data
    
    try:
        enhanced = enhance_roadmap_with_ai(provider, roadmap_data, career_path)
        return enhanced
    except Exception:
        # If AI enhancement fails, return original data
        return roadmap_data
