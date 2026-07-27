"""
Pydantic schemas for the generic roadmap import (MD/JSON).
Internal data structures used by roadmap_parser.py.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

# ──────────────── Internal parsed data ────────────────

class SubtopicImportData(BaseModel):
    """One subtopic parsed from a list item."""
    title: str
    order: int
    resource_label: Optional[str] = None
    resource_url: Optional[str] = None

class TopicImportData(BaseModel):
    """One topic parsed from a ### heading."""
    title: str
    order: int
    subtopics: List[SubtopicImportData] = []

class PhaseImportData(BaseModel):
    """One phase parsed from a ## heading."""
    title: str
    index: int
    topics: List[TopicImportData] = []

class CareerImportData(BaseModel):
    """Full parsed career, ready to persist."""
    title: str
    source_ref: str  # filename
    phases: List[PhaseImportData] = []

# ──────────────── API response schemas ────────────────

class ImportErrorResponse(BaseModel):
    """Returned when parsing fails or validation rejects the file."""
    ok: bool = False
    error: str

class ImportSuccessResponse(BaseModel):
    """Returned when import succeeds."""
    ok: bool = True
    career_id: int
    career_title: str
    phase_count: int
    topic_count: int
    subtopic_count: int
    resource_count: int
    warnings: List[str] = []

ImportResponse = ImportErrorResponse | ImportSuccessResponse