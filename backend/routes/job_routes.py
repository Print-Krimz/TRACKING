"""
Job Routes

API endpoints for job requisition management.

Protected Routes:
- POST /jobs - Create new job (Recruiter/Admin)
- GET /jobs - List jobs (All authenticated users)
- GET /jobs/{id} - Get job details
- PUT /jobs/{id} - Update job (Recruiter/Admin)
- DELETE /jobs/{id} - Delete job (Recruiter/Admin)
- POST /jobs/{id}/extract-keywords - AI keyword extraction (Recruiter/Admin)
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user, check_permissions
from models.user import User
from models.job import JobStatus
from schemas.job import (
    JobCreateRequest,
    JobUpdateRequest,
    JobResponse,
    JobListResponse,
    JobListItem,
    KeywordExtractionResponse
)
from models.controllers.job_controller import (
    create_job,
    get_jobs,
    get_job_by_id,
    update_job,
    delete_job,
    extract_keywords
)


router = APIRouter(
    prefix="/jobs",
    tags=["Jobs"],
    responses={401: {"description": "Not authenticated"}}
)


@router.post(
    "/",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create job requisition",
    description="Create a new job requisition. **Requires 'manage_jobs' permission.**"
)
def create_job_endpoint(
    request: JobCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_jobs"))
):
    """Create a new job requisition."""
    return create_job(session, current_user, request)


@router.get(
    "/",
    response_model=JobListResponse,
    summary="List jobs",
    description="""
    List job requisitions.
    
    **Candidates:** See only OPEN jobs
    **Recruiters/Admins:** See all jobs with filtering options
    """
)
def list_jobs_endpoint(
    status_filter: Optional[JobStatus] = Query(default=None, alias="status"),
    include_closed: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List job requisitions."""
    skip = (page - 1) * limit
    jobs, total, total_pages = get_jobs(session, current_user, status_filter, include_closed, skip, limit)
    return JobListResponse(
        jobs=jobs, 
        total=total, 
        page=page, 
        limit=limit, 
        total_pages=total_pages
    )


@router.get(
    "/{job_id}",
    response_model=JobResponse,
    summary="Get job details",
    description="Get detailed information about a specific job requisition."
)
def get_job_endpoint(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get job details by ID."""
    try:
        return get_job_by_id(session, job_id, current_user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put(
    "/{job_id}",
    response_model=JobResponse,
    summary="Update job",
    description="Update a job requisition. **Requires 'manage_jobs' permission.**"
)
def update_job_endpoint(
    job_id: int,
    request: JobUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_jobs"))
):
    """Update a job requisition."""
    try:
        return update_job(session, job_id, current_user, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete job",
    description="Delete a job requisition. **Requires 'manage_jobs' permission.**"
)
def delete_job_endpoint(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_jobs"))
):
    """Delete a job requisition."""
    try:
        delete_job(session, job_id, current_user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/{job_id}/extract-keywords",
    response_model=KeywordExtractionResponse,
    summary="Extract keywords",
    description="""
    Use AI to extract keywords from the job description.
    
    Keywords are used for semantic matching with candidate resumes.
    **Requires 'manage_jobs' permission.**
    """
)
def extract_keywords_endpoint(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_jobs"))
):
    """Extract keywords from job description using AI."""
    try:
        keywords = extract_keywords(session, job_id, current_user)
        return KeywordExtractionResponse(
            job_id=job_id,
            keywords=keywords,
            extracted_count=len(keywords)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
