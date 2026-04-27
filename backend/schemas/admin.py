from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    user_id: int
    username: str
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: List[AuditLogResponse]
    total: int


class SystemStatsResponse(BaseModel):
    total_users: int
    total_applicants: int
    total_recruiters: int
    total_admins: int
    total_jobs: int
    open_jobs: int
    total_applications: int
    total_resumes: int
    total_documents: int
    total_clients: int
    total_deployments: int
    active_deployments: int
    storage_bytes: int
    audit_log_count: int
