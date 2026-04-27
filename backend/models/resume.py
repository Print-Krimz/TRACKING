"""
Resume Model

Defines the Resume entity for storing applicant resumes and AI analysis results.

The resume workflow:
1. Applicant submits resume text content
2. Recruiter/Admin triggers AI analysis
3. Gemini API analyzes the resume and returns structured feedback
4. Analysis result is stored in the analysis_result field
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, Relationship, SQLModel, Column
from sqlalchemy import Text

if TYPE_CHECKING:
    from models.user import User


class Resume(SQLModel, table=True):
    """
    Resume model representing a submitted resume and its AI analysis.
    
    Each resume is owned by an Applicant user and can be analyzed
    by Recruiters or Admins using the Gemini AI API.
    
    Attributes:
        id: Unique identifier (auto-generated primary key)
        user_id: Foreign key to the owning User (Applicant)
        content: The resume text content (full text, no size limit)
        analysis_result: JSON/Text result from Gemini AI analysis
                        None until analysis is triggered
        created_at: Timestamp when the resume was submitted
        user: Reference to the owning User object
    
    Analysis Result Format (from Gemini):
        {
            "score": 8,
            "strengths": ["Strong technical skills", "Good communication"],
            "weaknesses": ["Lacks specific project examples"],
            "summary": "Well-qualified candidate for software engineer role",
            "recommendations": ["Add more quantifiable achievements"]
        }
    """
    __tablename__ = "resume"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Foreign key to User (the applicant who owns this resume)
    user_id: int = Field(
        foreign_key="user.id",
        description="Foreign key to the resume owner (Applicant user)"
    )
    
    # Resume content - using Text type for potentially large content
    content: str = Field(
        sa_column=Column(Text),
        description="Full resume text content"
    )
    
    # AI analysis result - stored as JSON string or structured text
    # None until analysis is triggered by Recruiter/Admin
    analysis_result: Optional[str] = Field(
        default=None,
        sa_column=Column(Text),
        description="Gemini AI analysis result (JSON format)"
    )

    # Phase 2: One-Time Extraction
    extracted_skills: Optional[str] = Field(
        default="[]", 
        sa_column=Column(Text),
        description="JSON array of skills extracted by LLM"
    )
    experience_years: Optional[int] = Field(
        default=0,
        description="Total years of experience extracted by LLM"
    )
    
    # File upload metadata (optional - only set for file uploads)
    original_filename: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Original filename if uploaded (e.g., 'resume.pdf')"
    )
    file_type: Optional[str] = Field(
        default=None,
        max_length=10,
        description="File type: 'pdf', 'docx', or 'text'"
    )
    
    # Timestamp for when the resume was submitted
    # Defaults to current UTC time
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of resume submission"
    )
    
    # Relationship to User - provides access to owner information
    user: Optional["User"] = Relationship(back_populates="resumes")
