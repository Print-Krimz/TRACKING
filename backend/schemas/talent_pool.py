"""
Talent Pool Schemas

Pydantic schemas for talent pool workflows.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from models.application import ApplicationStatus
from models.talent_pool import TalentPoolStatus


class TalentPoolSaveRequest(BaseModel):
    """Request payload for saving an application into the talent pool."""

    application_id: int
    notes: Optional[str] = None
    auto_rescan: bool = True


class TalentPoolEntryResponse(BaseModel):
    """Recruiter-facing talent pool entry payload."""

    id: int
    source_application_id: int
    candidate_id: int
    candidate_name: str
    resume_id: int
    source_job_id: Optional[int] = None
    source_job_title: Optional[str] = None
    source_status: ApplicationStatus
    pool_status: TalentPoolStatus
    notes: Optional[str] = None
    best_match_job_id: Optional[int] = None
    best_match_job_title: Optional[str] = None
    best_match_score: Optional[int] = None
    matched_open_jobs_count: int = 0
    pooled_at: datetime
    updated_at: datetime
    last_rescanned_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TalentPoolSaveResponse(BaseModel):
    """Save result for a talent pool action."""

    created: bool
    entry: TalentPoolEntryResponse


class TalentPoolListResponse(BaseModel):
    """Paged talent pool response."""

    entries: List[TalentPoolEntryResponse]
    total: int
    page: int = 1
    limit: int = 50
    total_pages: int = 1


class TalentPoolRescanResponse(BaseModel):
    """Result of rescanning one talent pool entry."""

    entry: TalentPoolEntryResponse


class TalentPoolBulkRescanResponse(BaseModel):
    """Result of rescanning multiple talent pool entries."""

    rescanned_count: int
    matched_entries: int
    entries: List[TalentPoolEntryResponse]
