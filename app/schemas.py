"""
Pydantic schemas for request/response validation.
"""
from __future__ import annotations

from datetime import datetime, date, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ──────────────── Roadmap (3 levels) ────────────────

class SubtopicBase(BaseModel):
    title: str
    order: int = 0
    done: bool = False
    notes: Optional[str] = None


class SubtopicCreate(SubtopicBase):
    pass


class SubtopicResponse(SubtopicBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    topic_id: int
    done_at: Optional[datetime] = None


class SubtopicResourceBase(BaseModel):
    label: str
    url: Optional[str] = None
    resource_id: Optional[int] = None


class SubtopicResourceResponse(SubtopicResourceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subtopic_id: int


class TopicBase(BaseModel):
    title: str
    order: int = 0
    status: str = "todo"


class TopicCreate(TopicBase):
    pass


class TopicResponse(TopicBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phase_id: int
    subtopics: List[SubtopicResponse] = []
    subtopic_count: int = 0
    done_subtopic_count: int = 0


class PhaseBase(BaseModel):
    index: int
    title: str
    description: Optional[str] = None
    accent: str = "#3fb950"
    status: str = "todo"


class PhaseCreate(PhaseBase):
    pass


class PhaseResponse(PhaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    roadmap_id: int
    topics: List[TopicResponse] = []
    topic_count: int = 0
    done_topic_count: int = 0
    progress_percent: int = 0


class RoadmapBase(BaseModel):
    title: str
    source: str = "manual"
    source_ref: Optional[str] = None
    is_active: bool = False


class RoadmapCreate(RoadmapBase):
    pass


class RoadmapResponse(RoadmapBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    phases: List[PhaseResponse] = []


# ──────────────── Resources ────────────────

class ResourceCategoryBase(BaseModel):
    slug: str
    label: str
    icon: Optional[str] = None


class ResourceCategoryResponse(ResourceCategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    roadmap_id: int


class ResourceBase(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    origin: str = "manual"
    link_status: str = "unknown"
    is_lab: bool = False
    is_tutorial: bool = False


class ResourceCreate(ResourceBase):
    category_id: Optional[int] = None


class ResourceResponse(ResourceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category_id: Optional[int] = None
    link_checked_at: Optional[datetime] = None
    created_at: datetime


# ──────────────── Projects ────────────────

class ProjectChecklistItemBase(BaseModel):
    label: str
    done: bool = False


class ProjectChecklistItemResponse(ProjectChecklistItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class ProjectBase(BaseModel):
    repo_name: str
    repo_url: Optional[str] = None
    description: Optional[str] = None
    status: str = "pending"


class ProjectCreate(ProjectBase):
    phase_id: int


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phase_id: int
    checklist_items: List[ProjectChecklistItemResponse] = []
    created_at: datetime


# ──────────────── Mailbox ────────────────

class MailboxItemBase(BaseModel):
    kind: str
    subject: str
    body: str
    related_id: Optional[int] = None
    requires_auth: bool = False
    status: str = "unread"


class MailboxItemCreate(MailboxItemBase):
    pass


class MailboxItemResponse(MailboxItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ──────────────── User Profile ────────────────

class UserProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    ai_language: str = "es"
    experience_level: Optional[str] = None
    weekly_hours: Optional[int] = None
    timezone: str = "UTC"
    goal: Optional[str] = None
    theme: str = "dark"
    accent_color: str = "#3fb950"


class UserProfileResponse(UserProfileBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ──────────────── AI Provider ────────────────

class AIProviderBase(BaseModel):
    name: str
    slug: str
    endpoint: str
    api_key_env_var: Optional[str] = None
    default_model: str
    is_local: bool = False
    is_active: bool = False


class AIProviderResponse(AIProviderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ──────────────── Chat ────────────────

class ChatMessageBase(BaseModel):
    role: str
    content: str
    attachment_path: Optional[str] = None
    attachment_type: Optional[str] = None


class ChatMessageCreate(ChatMessageBase):
    pass


class ChatMessageResponse(ChatMessageBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


# ──────────────── Daily Notes ────────────────

class DailyNoteBase(BaseModel):
    date: date
    content_richtext: str = ""
    content_drawing: Optional[str] = None


class DailyNoteResponse(DailyNoteBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ──────────────── Health / Stats ────────────────

class HealthResponse(BaseModel):
    status: str
    db: str
    timestamp: datetime


class DashboardStats(BaseModel):
    total_phases: int
    done_phases: int
    total_topics: int
    done_topics: int
    total_subtopics: int
    done_subtopics: int
    total_resources: int
    active_providers: int
    unread_mailbox: int
