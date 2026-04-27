"""
Application Model

Represents a candidate's application to a job requisition.
Tracks the full application lifecycle from submission to hire/rejection.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, Relationship, SQLModel


if TYPE_CHECKING:
    from models.user import User
    from models.resume import Resume
    from models.job import JobRequisition


class ApplicationStatus(str, Enum):
    """Application status through the hiring pipeline."""
    RECEIVED = "received"
    SCREENING = "screening"
    INTERVIEW = "interview"
    OFFER = "offer"
    HIRED = "hired"
    DEPLOYED = "deployed"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class Application(SQLModel, table=True):
    """
    Job application model linking candidates to job requisitions.
    
    Attributes:
        id: Unique identifier
        job_id: Foreign key to job requisition
        candidate_id: Foreign key to user (candidate)
        resume_id: Foreign key to resume used for application
        status: Current application status
        match_score: AI-calculated match score (0-100)
        applied_at: When the application was submitted
        updated_at: Last status update
        notes: Recruiter notes (private)
    """
    __tablename__ = "application"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign keys
    job_id: int = Field(
        foreign_key="job_requisition.id",
        index=True
    )
    candidate_id: int = Field(
        foreign_key="user.id",
        index=True
    )
    resume_id: Optional[int] = Field(
        default=None,
        foreign_key="resume.id"
    )
    
    # Status tracking
    status: ApplicationStatus = Field(
        default=ApplicationStatus.RECEIVED,
        description="Current application status"
    )
    
    # AI matching
    match_score: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="AI-calculated match score (0-100)"
    )
    score_breakdown: Optional[str] = Field(
        default=None,
        description="JSON breakdown of score components"
    )
    
    # Shortlisting
    is_shortlisted: bool = Field(
        default=False,
        description="Whether the candidate has been shortlisted by a recruiter"
    )
    
    # Timestamps
    applied_at: datetime = Field(
        default_factory=datetime.utcnow
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )
    
    # Recruiter notes (private)
    notes: Optional[str] = Field(
        default=None,
        description="Private recruiter notes"
    )
    
    # Relationships
    job: Optional["JobRequisition"] = Relationship()
    candidate: Optional["User"] = Relationship()
    resume: Optional["Resume"] = Relationship()
