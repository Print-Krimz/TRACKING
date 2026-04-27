from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class InterviewMode(str, Enum):
    ONSITE = "onsite"
    VIRTUAL = "virtual"
    PHONE = "phone"


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    RESCHEDULED = "rescheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class ApplicationInterview(SQLModel, table=True):
    __tablename__ = "application_interview"

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True)
    scheduled_by_user_id: int = Field(foreign_key="user.id", index=True)
    interviewer_user_id: Optional[int] = Field(default=None, foreign_key="user.id")

    scheduled_start_at: datetime = Field(index=True)
    scheduled_end_at: datetime
    timezone: str = Field(default="UTC", max_length=50)
    mode: InterviewMode = Field(default=InterviewMode.VIRTUAL)
    location_or_link: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=2000)
    status: InterviewStatus = Field(default=InterviewStatus.SCHEDULED, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
