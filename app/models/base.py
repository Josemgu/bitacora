"""
Bitacora v2 — Complete SQLAlchemy models.
Three-level roadmap: phases -> topics -> subtopics.
"""
from __future__ import annotations

import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, Time,
    ForeignKey, Enum, Float, JSON, UniqueConstraint, event,
)
from sqlalchemy.orm import relationship, validates

from app.database import Base


class RoadmapSource(str, PyEnum):
    manual = "manual"
    roadmapsh = "roadmapsh"
    ai_generated = "ai_generated"
    md_import = "md_import"


class ItemStatus(str, PyEnum):
    done = "done"
    current = "current"
    todo = "todo"


class ResourceOrigin(str, PyEnum):
    manual = "manual"
    ai_discovered = "ai_discovered"
    md_import = "md_import"


class LinkStatus(str, PyEnum):
    ok = "ok"
    broken = "broken"
    redirect = "redirect"
    unknown = "unknown"


class QueueStatus(str, PyEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ProjectStatus(str, PyEnum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"


class MailboxKind(str, PyEnum):
    news = "news"
    new_resource = "new_resource"
    broken_link = "broken_link"
    reminder = "reminder"
    suggestion = "suggestion"
    roadmap_update = "roadmap_update"


class MailboxStatus(str, PyEnum):
    unread = "unread"
    read = "read"
    approved = "approved"
    rejected = "rejected"
    dismissed = "dismissed"


class ExperienceLevel(str, PyEnum):
    principiante = "principiante"
    intermedio = "intermedio"
    avanzado = "avanzado"


class UserRole(str, PyEnum):
    admin = "admin"
    instructor = "instructor"
    student = "student"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.student, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    source = Column(Enum(RoadmapSource), nullable=False, default=RoadmapSource.manual)
    source_ref = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    # Change-tracking for roadmap.sh sync (Sprint 2).
    version_hash = Column(String(64), nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    source_metadata = Column(Text, nullable=True)

    phases = relationship("Phase", back_populates="roadmap", cascade="all, delete-orphan")
    resource_categories = relationship("ResourceCategory", back_populates="roadmap", cascade="all, delete-orphan")


class Phase(Base):
    __tablename__ = "phases"

    id = Column(Integer, primary_key=True, index=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id"), nullable=False)
    index = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    accent = Column(String(7), default="#3fb950")
    status = Column(Enum(ItemStatus), default=ItemStatus.todo)

    roadmap = relationship("Roadmap", back_populates="phases")
    topics = relationship("Topic", back_populates="phase", cascade="all, delete-orphan", order_by="Topic.order")
    projects = relationship("Project", back_populates="phase", cascade="all, delete-orphan")

    @property
    def topic_count(self):
        return len(self.topics)

    @property
    def done_topic_count(self):
        return sum(1 for t in self.topics if t.status == ItemStatus.done)

    @property
    def progress_percent(self):
        if not self.topics:
            return 0
        return int((self.done_topic_count / len(self.topics)) * 100)


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    title = Column(String(300), nullable=False)
    order = Column(Integer, nullable=False, default=0)
    status = Column(Enum(ItemStatus), default=ItemStatus.todo)

    phase = relationship("Phase", back_populates="topics")
    subtopics = relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan", order_by="Subtopic.order")

    @property
    def subtopic_count(self):
        return len(self.subtopics)

    @property
    def done_subtopic_count(self):
        return sum(1 for s in self.subtopics if s.done)

    def recalculate_status(self):
        if not self.subtopics:
            return
        if all(s.done for s in self.subtopics):
            self.status = ItemStatus.done
        elif any(s.done for s in self.subtopics):
            self.status = ItemStatus.current
        else:
            self.status = ItemStatus.todo


class Subtopic(Base):
    __tablename__ = "subtopics"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    title = Column(String(400), nullable=False)
    order = Column(Integer, nullable=False, default=0)
    done = Column(Boolean, default=False, nullable=False)
    done_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    topic = relationship("Topic", back_populates="subtopics")
    resources = relationship("SubtopicResource", back_populates="subtopic", cascade="all, delete-orphan")


class SubtopicResource(Base):
    __tablename__ = "subtopic_resources"

    id = Column(Integer, primary_key=True, index=True)
    subtopic_id = Column(Integer, ForeignKey("subtopics.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    label = Column(String(200), nullable=False)
    url = Column(String(1000), nullable=True)

    subtopic = relationship("Subtopic", back_populates="resources")
    resource = relationship("Resource")


class ResourceCategory(Base):
    __tablename__ = "resource_categories"

    id = Column(Integer, primary_key=True, index=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id"), nullable=False)
    slug = Column(String(50), nullable=False)
    label = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=True)

    roadmap = relationship("Roadmap", back_populates="resource_categories")
    resources = relationship("Resource", back_populates="category")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("resource_categories.id"), nullable=True)
    title = Column(String(300), nullable=False)
    url = Column(String(1000), nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    origin = Column(Enum(ResourceOrigin), default=ResourceOrigin.manual)
    link_status = Column(Enum(LinkStatus), default=LinkStatus.unknown)
    link_checked_at = Column(DateTime, nullable=True)
    is_lab = Column(Boolean, default=False)
    is_tutorial = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    category = relationship("ResourceCategory", back_populates="resources")


class ResourceQueue(Base):
    __tablename__ = "resource_queue"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    url = Column(String(1000), nullable=False)
    description = Column(Text, nullable=True)
    category_slug = Column(String(50), nullable=True)
    rationale = Column(Text, nullable=False)
    found_by = Column(String(100), nullable=True)
    status = Column(Enum(QueueStatus), default=QueueStatus.pending)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    repo_name = Column(String(200), nullable=False)
    repo_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.pending)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    phase = relationship("Phase", back_populates="projects")
    checklist_items = relationship("ProjectChecklistItem", back_populates="project", cascade="all, delete-orphan")


class ProjectChecklistItem(Base):
    __tablename__ = "project_checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    label = Column(String(200), nullable=False)
    done = Column(Boolean, default=False)

    project = relationship("Project", back_populates="checklist_items")


class MailboxItem(Base):
    __tablename__ = "mailbox_items"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(Enum(MailboxKind), nullable=False)
    subject = Column(String(400), nullable=False)
    body = Column(Text, nullable=False)
    related_id = Column(Integer, nullable=True)
    requires_auth = Column(Boolean, default=False)
    is_actionable = Column(Boolean, default=False, nullable=False)
    action_url = Column(String(1000), nullable=True)
    status = Column(Enum(MailboxStatus), default=MailboxStatus.unread)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    subtopic_id = Column(Integer, ForeignKey("subtopics.id"), nullable=True)
    planned_at = Column(Time, nullable=True)


class DailyNote(Base):
    __tablename__ = "daily_notes"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False)
    content_richtext = Column(Text, default="")
    content_drawing = Column(Text, nullable=True)
    onenote_synced_at = Column(DateTime, nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    attachment_path = Column(String(500), nullable=True)
    attachment_type = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, default=1)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    ai_language = Column(String(10), default="es")
    experience_level = Column(Enum(ExperienceLevel), nullable=True)
    weekly_hours = Column(Integer, nullable=True)
    timezone = Column(String(50), default="UTC")
    goal = Column(Text, nullable=True)
    theme = Column(String(10), default="dark")
    accent_color = Column(String(7), default="#3fb950")
    # AI acting as the active instructor/administrator (Sprint 3).
    ai_instructor_id = Column(Integer, ForeignKey("ai_providers.id"), nullable=True)
    last_login = Column(DateTime, nullable=True)


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    slug = Column(String(30), unique=True, nullable=False)
    endpoint = Column(String(500), nullable=False)
    api_key_env_var = Column(String(100), nullable=True)
    # API key encrypted at rest with Fernet (never stored in plaintext).
    api_key_encrypted = Column(Text, nullable=True)
    default_model = Column(String(100), nullable=False)
    is_local = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)
    # Marks the provider currently acting as the learning instructor.
    is_instructor = Column(Boolean, default=False, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    timeout_seconds = Column(Integer, default=60, nullable=False)
    config_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
