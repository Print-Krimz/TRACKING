from datetime import datetime
from typing import Any, Optional, List

from pydantic import BaseModel, Field

from models.application import ApplicationStatus


class AutomationFlagsResponse(BaseModel):
    flags: dict[str, bool]


class AutomationMetricsResponse(BaseModel):
    total_jobs: int
    success_rate: float
    failed_jobs: int
    retries: int
    avg_latency_ms: float


class JobDraftCriterionSuggestion(BaseModel):
    skill_name: str
    is_must_have: bool = False
    weight: int = Field(default=5, ge=1, le=10)


class JobDraftAssistRequest(BaseModel):
    title: Optional[str] = None
    description_text: Optional[str] = None
    target_role: Optional[str] = None


class JobDraftAssistResponse(BaseModel):
    title: str
    description: str
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: str = "full-time"
    experience_years: Optional[int] = None
    education_level: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    salary_hint: Optional[str] = None
    criteria: List[JobDraftCriterionSuggestion] = []


class BulkApplicationActionRequest(BaseModel):
    application_ids: List[int]
    status: Optional[ApplicationStatus] = None
    shortlisted: Optional[bool] = None
    notes: Optional[str] = None


class BulkApplicationActionItemResult(BaseModel):
    application_id: int
    success: bool
    status: Optional[str] = None
    error: Optional[str] = None


class BulkApplicationActionResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    results: List[BulkApplicationActionItemResult]


class ReportScheduleCreateRequest(BaseModel):
    name: str = Field(max_length=150)
    report_type: str
    format: str = Field(default="json", max_length=20)
    cadence: str = Field(default="manual", max_length=30)
    job_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    delivery_channel: str = Field(default="in_app", max_length=30)
    recipient_email: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)


class ReportScheduleResponse(BaseModel):
    id: int
    name: str
    report_type: str
    format: str
    cadence: str
    job_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    delivery_channel: str
    recipient_email: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ReportScheduleListResponse(BaseModel):
    schedules: List[ReportScheduleResponse]
    total: int


class InterviewSlotSuggestionRequest(BaseModel):
    application_id: Optional[int] = None
    timezone: str = "UTC"
    duration_minutes: int = Field(default=60, ge=15, le=180)
    window_days: int = Field(default=5, ge=1, le=21)
    slot_count: int = Field(default=3, ge=1, le=10)


class InterviewSlotSuggestionResponse(BaseModel):
    scheduled_start_at: datetime
    scheduled_end_at: datetime
    label: str


class InterviewInviteRequest(BaseModel):
    template: Optional[str] = None
    notes: Optional[str] = None


class InterviewInviteResponse(BaseModel):
    interview_id: int
    message: str
