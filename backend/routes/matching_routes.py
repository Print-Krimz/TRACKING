"""
Matching Routes

API endpoints for AI-powered candidate matching and ranking.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session
from pydantic import BaseModel

from database import get_session
from dependencies import check_permissions, get_current_user
from models.user import User
from models.job import JobRequisition
from models.application import Application
from services.matching_service import (
    get_matched_candidates,
    score_application,
    batch_score_applications,
    calculate_match_score,
    get_job_ai_summary
)


router = APIRouter(
    prefix="/matching",
    tags=["Matching"],
    responses={401: {"description": "Not authenticated"}}
)


class MatchResponse(BaseModel):
    application_id: int
    candidate_id: int
    candidate_name: str
    match_score: Optional[int]
    score_breakdown: Optional[dict]
    status: str
    applied_at: str


class ScoreResponse(BaseModel):
    application_id: int
    match_score: Optional[int]
    breakdown: Optional[dict] = None
    error: Optional[str] = None


@router.get(
    "/jobs/{job_id}/candidates",
    summary="Get matched candidates for a job",
    description="Get candidates matched to a job, ranked by AI score. **Requires 'view_all_applications' permission.**"
)
def get_job_matches(
    job_id: int,
    min_score: int = Query(default=0, ge=0, le=100),
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_all_applications"))
):
    """Get matched candidates for a job, sorted by match score."""
    
    # Verify job exists
    job = session.get(JobRequisition, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    candidates = get_matched_candidates(session, job_id, min_score, limit)
    
    return {
        "job_id": job_id,
        "job_title": job.title,
        "candidates": candidates,
        "total": len(candidates)
    }

@router.get(
    "/jobs/{job_id}/ai-summary",
    summary="Generate AI summary of top candidates",
    description="Summarize the top 10 ranked candidates for recruiters using Gemini."
)
def generate_job_summary(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_all_applications"))
):
    """Generate paragraph summary of top candidates."""
    try:
        summary = get_job_ai_summary(session, job_id)
        return {"summary": summary}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/applications/{application_id}/score",
    response_model=ScoreResponse,
    summary="Score an application",
    description="Calculate AI match score for an application. **Requires 'manage_applications' permission.**"
)
def score_single_application(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    """Calculate and store match score for an application."""
    
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    try:
        result = score_application(session, application_id)
        return ScoreResponse(**result)
    except Exception as e:
        return ScoreResponse(
            application_id=application_id,
            match_score=None,
            error=str(e)
        )


@router.post(
    "/jobs/{job_id}/score-all",
    summary="Score all applications for a job",
    description="Batch score all unscored applications for a job. **Requires 'manage_applications' permission.**"
)
def score_job_applications(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    """Batch score all applications for a job."""
    
    job = session.get(JobRequisition, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    results = batch_score_applications(session, job_id)
    
    return {
        "job_id": job_id,
        "scored_count": len([r for r in results if r.get("match_score") is not None]),
        "error_count": len([r for r in results if r.get("error")]),
        "results": results
    }


@router.get(
    "/applications/{application_id}/breakdown",
    summary="Get score breakdown",
    description="Get detailed score breakdown for an application. **Requires 'view_all_applications' permission.**"
)
def get_score_breakdown(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_all_applications"))
):
    """Get detailed score breakdown for an application."""
    
    application = session.get(Application, application_id)
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    import json
    
    breakdown = None
    if application.score_breakdown:
        try:
            breakdown = json.loads(application.score_breakdown)
        except:
            breakdown = None
    
    return {
        "application_id": application_id,
        "match_score": application.match_score,
        "breakdown": breakdown,
        "job_id": application.job_id,
        "candidate_id": application.candidate_id
    }
