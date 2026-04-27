from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from models.application_interview import InterviewMode, InterviewStatus


class InterviewCreateRequest(BaseModel):
    interviewer_user_id: Optional[int] = None
    scheduled_start_at: datetime
    scheduled_end_at: datetime
    timezone: str = Field(default="UTC", max_length=50)
    mode: InterviewMode = InterviewMode.VIRTUAL
    location_or_link: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=2000)


class InterviewUpdateRequest(BaseModel):
    status: Optional[InterviewStatus] = None
    interviewer_user_id: Optional[int] = None
    scheduled_start_at: Optional[datetime] = None
    scheduled_end_at: Optional[datetime] = None
    timezone: Optional[str] = Field(default=None, max_length=50)
    mode: Optional[InterviewMode] = None
    location_or_link: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=2000)


class InterviewResponse(BaseModel):
    id: int
    application_id: int
    scheduled_by_user_id: int
    interviewer_user_id: Optional[int] = None
    scheduled_start_at: datetime
    scheduled_end_at: datetime
    timezone: str
    mode: InterviewMode
    location_or_link: Optional[str] = None
    notes: Optional[str] = None
    status: InterviewStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InterviewListResponse(BaseModel):
    interviews: List[InterviewResponse]
    total: int
