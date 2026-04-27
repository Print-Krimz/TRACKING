"""
Job Schemas

Pydantic schemas for job-related API requests and responses.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from models.job import JobStatus


# =============================================================================
# Job Criteria Schemas
# =============================================================================

class JobCriteriaCreate(BaseModel):
    """Schema for creating job criteria."""
    skill_name: str = Field(..., max_length=100)
    is_must_have: bool = False
    weight: int = Field(default=5, ge=1, le=10)


class JobCriteriaResponse(BaseModel):
    """Schema for job criteria in responses."""
    id: int
    skill_name: str
    is_must_have: bool
    weight: int

    class Config:
        from_attributes = True


# =============================================================================
# Job Keyword Schemas
# =============================================================================

class JobKeywordResponse(BaseModel):
    """Schema for job keywords in responses."""
    id: int
    keyword: str
    category: Optional[str] = None

    class Config:
        from_attributes = True


# =============================================================================
# Job Requisition Schemas
# =============================================================================

class JobCreateRequest(BaseModel):
    """Schema for creating a new job requisition."""
    title: str = Field(..., max_length=200)
    description: str
    department: Optional[str] = Field(default=None, max_length=100)
    location: Optional[str] = Field(default=None, max_length=200)
    employment_type: str = Field(default="full-time", max_length=50)
    experience_years: Optional[int] = None
    education_level: Optional[str] = Field(default=None, max_length=100)
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    status: Optional[JobStatus] = Field(default=JobStatus.OPEN)
    criteria: List[JobCriteriaCreate] = []


class JobUpdateRequest(BaseModel):
    """Schema for updating a job requisition."""
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    department: Optional[str] = Field(default=None, max_length=100)
    location: Optional[str] = Field(default=None, max_length=200)
    employment_type: Optional[str] = Field(default=None, max_length=50)
    experience_years: Optional[int] = None
    education_level: Optional[str] = Field(default=None, max_length=100)
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    status: Optional[JobStatus] = None
    criteria: Optional[List[JobCriteriaCreate]] = None


class JobResponse(BaseModel):
    """Schema for job requisition responses."""
    id: int
    title: str
    description: str
    department: Optional[str]
    location: Optional[str]
    employment_type: str
    experience_years: Optional[int]
    education_level: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    salary_currency: str
    status: JobStatus
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    criteria: List[JobCriteriaResponse] = []
    keywords: List[JobKeywordResponse] = []

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Schema for listing jobs."""
    jobs: List[JobResponse]
    total: int
    page: int = 1
    limit: int = 50
    total_pages: int = 1


class JobListItem(BaseModel):
    """Simplified job item for lists."""
    id: int
    title: str
    department: Optional[str]
    location: Optional[str]
    employment_type: str
    status: JobStatus
    created_at: datetime
    criteria_count: int = 0
    application_count: int = 0

    class Config:
        from_attributes = True


# =============================================================================
# Keyword Extraction Schema
# =============================================================================

class KeywordExtractionResponse(BaseModel):
    """Response from AI keyword extraction."""
    job_id: int
    keywords: List[JobKeywordResponse]
    extracted_count: int
