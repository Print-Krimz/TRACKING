"""
Application Schemas

Pydantic schemas for job application API requests and responses.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from models.application import ApplicationStatus
from models.quiz import QuizOutcome


class QuizAnswerRequest(BaseModel):
    """One selected answer for a quiz question."""

    question_id: str
    selected_option: int = Field(ge=0, le=3)


class JobQuizQuestionResponse(BaseModel):
    """Quiz question payload shown to candidates."""

    question_id: str
    skill_name: str
    question_text: str
    options: List[str]
    difficulty: str = "medium"
    is_must_have: bool = False


class JobQuizResponse(BaseModel):
    """Role-based quiz to complete before applying."""

    job_id: int
    job_title: str
    total_questions: int
    pass_score_percent: int
    must_have_pass_percent: int
    questions: List[JobQuizQuestionResponse]


class QuizSkillBreakdownItem(BaseModel):
    """Per-skill score summary."""

    skill_name: str
    total: int
    correct: int
    percent: int
    is_must_have: bool = False


class ApplicationQuizResultResponse(BaseModel):
    """Quiz result details attached to an application."""

    total_questions: int
    correct_answers: int
    score_percent: int
    must_have_score_percent: int
    passed: bool
    outcome: QuizOutcome
    breakdown: List[QuizSkillBreakdownItem] = []
    submitted_at: datetime


class ApplicationCreateRequest(BaseModel):
    """Schema for creating a job application."""
    job_id: int
    resume_id: Optional[int] = None  # Optional - can apply without resume
    quiz_answers: List[QuizAnswerRequest] = Field(default_factory=list)


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
    in_talent_pool: bool = False
    quiz_result: Optional[ApplicationQuizResultResponse] = None
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
    quiz_outcome: Optional[QuizOutcome] = None
    quiz_score_percent: Optional[int] = None
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
