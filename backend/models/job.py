"""
Job Requisition Model

Defines job postings that candidates can apply to.
Recruiters create job requisitions with criteria for matching.

This is the core of the ATS matching system - jobs are matched
against candidate resumes using AI-powered semantic matching.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, Relationship, SQLModel, Column, Text


if TYPE_CHECKING:
    from models.user import User


class JobStatus(str, Enum):
    """Status of a job requisition."""
    DRAFT = "draft"
    OPEN = "open"
    PAUSED = "paused"
    CLOSED = "closed"
    FILLED = "filled"


class JobRequisition(SQLModel, table=True):
    """
    Job requisition model representing an open position.
    
    Attributes:
        id: Unique identifier
        title: Job title (e.g., "Senior Software Engineer")
        description: Full job description with responsibilities
        department: Department/team (e.g., "Engineering")
        location: Job location (e.g., "Remote", "New York, NY")
        employment_type: Full-time, Part-time, Contract, etc.
        experience_years: Required years of experience
        salary_min: Minimum salary (optional)
        salary_max: Maximum salary (optional)
        status: Current status (draft, open, paused, closed, filled)
        created_by: ID of the recruiter who created it
        created_at: When the job was created
        updated_at: Last update timestamp
    """
    __tablename__ = "job_requisition"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Basic info
    title: str = Field(
        max_length=200,
        index=True,
        description="Job title"
    )
    description: str = Field(
        sa_column=Column(Text),
        description="Full job description"
    )
    department: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Department or team"
    )
    location: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Job location"
    )
    employment_type: str = Field(
        default="full-time",
        max_length=50,
        description="Employment type: full-time, part-time, contract, internship"
    )
    
    # Requirements
    experience_years: Optional[int] = Field(
        default=None,
        description="Required years of experience"
    )
    education_level: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Required education level"
    )
    
    # Compensation (optional)
    salary_min: Optional[int] = Field(
        default=None,
        description="Minimum salary"
    )
    salary_max: Optional[int] = Field(
        default=None,
        description="Maximum salary"
    )
    salary_currency: str = Field(
        default="USD",
        max_length=10
    )
    
    # Status
    status: JobStatus = Field(
        default=JobStatus.DRAFT,
        description="Job status"
    )
    
    # Metadata
    created_by: Optional[int] = Field(
        default=None,
        foreign_key="user.id",
        description="Recruiter who created this job"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )
    
    # Relationships
    creator: Optional["User"] = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[JobRequisition.created_by]"}
    )
    criteria: List["JobCriteria"] = Relationship(
        back_populates="job",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    keywords: List["JobKeyword"] = Relationship(
        back_populates="job",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class JobCriteria(SQLModel, table=True):
    """
    Job criteria model for matching requirements.
    
    Each job can have multiple criteria (skills, qualifications).
    Criteria are weighted for scoring candidates.
    
    Attributes:
        id: Unique identifier
        job_id: Foreign key to job requisition
        skill_name: Name of the skill/qualification
        is_must_have: True if required, False if nice-to-have
        weight: Importance weight (1-10) for scoring
    """
    __tablename__ = "job_criteria"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    job_id: int = Field(
        foreign_key="job_requisition.id",
        index=True
    )
    skill_name: str = Field(
        max_length=100,
        description="Skill or qualification name"
    )
    is_must_have: bool = Field(
        default=False,
        description="True if required, False if nice-to-have"
    )
    weight: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Importance weight (1-10)"
    )
    
    # Relationship
    job: Optional[JobRequisition] = Relationship(back_populates="criteria")


class JobKeyword(SQLModel, table=True):
    """
    AI-extracted keywords from job description.
    
    These keywords are automatically extracted when a job is created
    and used for semantic matching with resumes.
    
    Attributes:
        id: Unique identifier
        job_id: Foreign key to job requisition
        keyword: Extracted keyword/phrase
        category: Type of keyword (skill, tool, concept)
    """
    __tablename__ = "job_keyword"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    job_id: int = Field(
        foreign_key="job_requisition.id",
        index=True
    )
    keyword: str = Field(
        max_length=100,
        description="Extracted keyword or phrase"
    )
    category: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Keyword category: skill, tool, concept, qualification"
    )
    
    # Relationship
    job: Optional[JobRequisition] = Relationship(back_populates="keywords")
