"""
Pydantic schemas for request/response validation.
"""
from __future__ import annotations

from datetime import datetime, date, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.validators import is_safe_url


# ──────────────── Roadmap (3 levels) ────────────────

class SubtopicBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=400)
    order: int = 0
    done: bool = False
    notes: Optional[str] = Field(None, max_length=5000)


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
    title: str = Field(..., min_length=1, max_length=300)
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
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    accent: str = Field("#3fb950", max_length=7)
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
    title: str = Field(..., min_length=1, max_length=300)
    url: str = Field(..., max_length=1000)
    description: Optional[str] = Field(None, max_length=5000)
    logo_url: Optional[str] = Field(None, max_length=500)
    origin: str = "manual"
    link_status: str = "unknown"
    is_lab: bool = False
    is_tutorial: bool = False

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        if not is_safe_url(v):
            raise ValueError("url must be a valid http(s) address")
        return v.strip()

    @field_validator("logo_url")
    @classmethod
    def _validate_logo_url(cls, v: Optional[str]) -> Optional[str]:
        if v and not is_safe_url(v):
            raise ValueError("logo_url must be a valid http(s) address")
        return v


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
    is_actionable: bool = False
    action_url: Optional[str] = None
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
    name: str = Field(..., min_length=1, max_length=50)
    slug: str = Field(..., min_length=1, max_length=30)
    endpoint: str = Field(..., max_length=500)
    api_key_env_var: Optional[str] = Field(None, max_length=100)
    default_model: str = Field(..., min_length=1, max_length=100)
    is_local: bool = False
    is_active: bool = False

    @field_validator("endpoint")
    @classmethod
    def _validate_endpoint(cls, v: str) -> str:
        if not is_safe_url(v):
            raise ValueError("endpoint must be a valid http(s) address")
        return v.strip()


class AIProviderCreate(AIProviderBase):
    # Raw API key supplied by the client; encrypted before storage and never
    # returned in any response.
    api_key: Optional[str] = Field(None, max_length=500)


class AIProviderResponse(AIProviderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    is_instructor: bool = False
    # Whether an encrypted key is stored — the key itself is never exposed.
    has_api_key: bool = False


# ──────────────── Chat ────────────────

class ChatMessageBase(BaseModel):
    role: str = Field(..., max_length=20)
    content: str = Field(..., min_length=1, max_length=20000)
    attachment_path: Optional[str] = Field(None, max_length=500)
    attachment_type: Optional[str] = Field(None, max_length=20)

    @field_validator("attachment_path")
    @classmethod
    def _no_path_traversal(cls, v: Optional[str]) -> Optional[str]:
        if v and (".." in v or v.startswith("/") or "\\" in v):
            raise ValueError("attachment_path must not contain path traversal")
        return v


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


# ──────────────── Auth ────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.\-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = Field(None, max_length=255)


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1, max_length=80)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
