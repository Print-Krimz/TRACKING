"""
Resume Schemas

Pydantic schemas for resume operations including submission,
retrieval, and AI analysis responses.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ResumeSubmitRequest(BaseModel):
    """
    Request schema for submitting a new resume.
    
    Used by the POST /resumes endpoint (Applicant only).
    The content field should contain the full resume text.
    
    Attributes:
        content: The full resume text content
    """
    content: str = Field(
        min_length=50,
        description="Resume text content (minimum 50 characters)"
    )


class ResumeResponse(BaseModel):
    """
    Response schema for a single resume.
    
    Includes all resume fields except potentially large analysis results.
    Use ResumeWithAnalysis for full data including analysis.
    """
    id: int
    user_id: int
    username: Optional[str] = Field(default=None, description="Owner's username")
    content: str
    analysis_result: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ResumeListResponse(BaseModel):
    """
    Response schema for listing multiple resumes.
    
    Used by the GET /resumes endpoint.
    - Applicants: See only their own resumes
    - Recruiters/Admins: See all resumes
    """
    resumes: List[ResumeResponse]
    total: int = Field(description="Total number of resumes")
    page: int = 1
    limit: int = 50
    total_pages: int = 1


class ResumeAnalysisResponse(BaseModel):
    """
    Response schema for resume analysis results.
    
    Returned after triggering AI analysis on a resume.
    The analysis_result contains the Gemini API response.
    """
    id: int
    content: str
    analysis_result: str = Field(description="Gemini AI analysis result")
    analyzed_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp of analysis"
    )
    
    class Config:
        from_attributes = True


class AnalyzeResumeRequest(BaseModel):
    """
    Request schema for customizing resume analysis.
    
    Optional parameters to customize the Gemini analysis prompt.
    """
    job_role: str = Field(
        default="software engineer",
        description="Target job role for analysis context"
    )
    additional_context: Optional[str] = Field(
        default=None,
        description="Additional context or requirements for analysis"
    )
