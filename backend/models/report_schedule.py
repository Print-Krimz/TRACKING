from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Text
from sqlmodel import Field, SQLModel


class ReportSchedule(SQLModel, table=True):
    __tablename__ = "report_schedule"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=150, index=True)
    report_type: str = Field(max_length=50, index=True)
    format: str = Field(default="json", max_length=20)
    cadence: str = Field(default="manual", max_length=30, index=True)

    job_id: Optional[int] = Field(default=None, foreign_key="job_requisition.id", index=True)
    date_from: Optional[datetime] = Field(default=None)
    date_to: Optional[datetime] = Field(default=None)
    delivery_channel: str = Field(default="in_app", max_length=30)
    recipient_email: Optional[str] = Field(default=None, max_length=255)
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)

    config_json: str = Field(default="{}", sa_column=Column(Text))
    is_active: bool = Field(default=True, index=True)
    last_run_at: Optional[datetime] = Field(default=None)
    next_run_at: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
