"""
Talent Pool Model

Represents candidates intentionally saved for future roles after they were
not selected for a specific application.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Text
from sqlmodel import Column, Field, SQLModel

from models.application import ApplicationStatus


class TalentPoolStatus(str, Enum):
    """Lifecycle state for a talent pool entry."""

    ACTIVE = "active"
    ARCHIVED = "archived"


class TalentPoolEntry(SQLModel, table=True):
    """
    Saved candidate profile for future rematching against open roles.

    A pool entry keeps the source application context plus the latest
    rematch snapshot against currently open requisitions.
    """

    __tablename__ = "talent_pool_entry"

    id: Optional[int] = Field(default=None, primary_key=True)

    candidate_id: int = Field(foreign_key="user.id", index=True)
    resume_id: int = Field(foreign_key="resume.id", index=True)
    source_application_id: int = Field(foreign_key="application.id", index=True)
    source_job_id: Optional[int] = Field(
        default=None,
        foreign_key="job_requisition.id",
        index=True,
    )
    added_by: Optional[int] = Field(default=None, foreign_key="user.id")

    source_status: ApplicationStatus = Field(default=ApplicationStatus.REJECTED)
    pool_status: TalentPoolStatus = Field(default=TalentPoolStatus.ACTIVE)

    notes: Optional[str] = Field(default=None, sa_column=Column(Text))

    best_match_job_id: Optional[int] = Field(
        default=None,
        foreign_key="job_requisition.id",
        index=True,
    )
    best_match_score: Optional[int] = Field(default=None, ge=0, le=100)
    matched_open_jobs_count: int = Field(default=0, ge=0)
    match_snapshot: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="JSON array of recent rematch results",
    )

    pooled_at: datetime = Field(default_factory=datetime.utcnow)
    last_rescanned_at: Optional[datetime] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
