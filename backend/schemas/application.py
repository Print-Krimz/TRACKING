"""
Application Schemas

Pydantic schemas for job application API requests and responses.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from models.application import ApplicationStatus


class ApplicationCreateRequest(BaseModel):
    """Schema for creating a job application."""
    job_id: int
    resume_id: Optional[int] = None  # Optional - can apply without resume


class ApplicationStatusUpdate(BaseModel):
    """Schema for updating application status."""
    status: ApplicationStatus
    notes: Optional[str] = None


class ApplicationResponse(BaseModel):
    """Full application response."""
    id: int
    job_id: int
    job_title: Optional[str] = None
    candidate_id: int
    candidate_name: Optional[str] = None
    resume_id: Optional[int]
    status: ApplicationStatus
    match_score: Optional[int]
    is_shortlisted: bool = False
    applied_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    """List of applications."""
    applications: List[ApplicationResponse]
    total: int
    page: int = 1
    limit: int = 50
    total_pages: int = 1


class CandidateApplicationResponse(BaseModel):
    """Application view for candidates (status tracker)."""
    id: int
    job_id: int
    job_title: str
    company_department: Optional[str]
    location: Optional[str]
    status: ApplicationStatus
    applied_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CandidateApplicationList(BaseModel):
    """List of applications for candidate view."""
    applications: List[CandidateApplicationResponse]
    total: int = 0
    page: int = 1
    limit: int = 50
    total_pages: int = 1
