from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


class AutomationJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class AutomationJob(SQLModel, table=True):
    __tablename__ = "automation_job"
    __table_args__ = (
        UniqueConstraint("job_type", "idempotency_key", name="uq_automation_job_idempotency"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    job_type: str = Field(index=True, max_length=80)
    idempotency_key: str = Field(index=True, max_length=120)
    actor_type: str = Field(default="user", max_length=20, index=True)
    actor_user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)

    payload_json: str = Field(sa_column=Column(Text))
    result_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))

    status: AutomationJobStatus = Field(default=AutomationJobStatus.QUEUED, index=True)
    attempts: int = Field(default=0, ge=0)
    max_attempts: int = Field(default=3, ge=1)
    latency_ms: Optional[int] = Field(default=None)

    next_retry_at: Optional[datetime] = Field(default=None, index=True)
    started_at: Optional[datetime] = Field(default=None)
    finished_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
