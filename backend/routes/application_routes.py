"""
Application Routes

API endpoints for job applications.

Protected Routes:
- POST /applications - Apply to a job (Candidate)
- GET /applications - List applications (role-based filtering)
- GET /applications/{id} - Get application details
- PATCH /applications/{id}/status - Update status (Recruiter/Admin)
- DELETE /applications/{id} - Remove candidate application record (Admin roles)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from datetime import datetime

from database import get_session
from dependencies import get_current_user, check_permissions
from models.user import User
from models.job import JobRequisition, JobStatus
from models.application import Application, ApplicationStatus
from models.resume import Resume
from schemas.application import (
    ApplicationCreateRequest,
    ApplicationStatusUpdate,
    ApplicationResponse,
    ApplicationListResponse,
    CandidateApplicationResponse,
    CandidateApplicationList
)


router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
    responses={401: {"description": "Not authenticated"}}
)


@router.post(
    "/",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to a job",
    description="Submit an application to a job. **Requires 'apply_to_job' permission (Candidate).**"
)
def apply_to_job(
    request: ApplicationCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("apply_to_job"))
):
    """Apply to a job posting."""
    # Check job exists and is open
    job = session.get(JobRequisition, request.job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    if job.status != JobStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job is not accepting applications"
        )
    
    # Check if already applied
    existing = session.exec(
        select(Application).where(
            Application.job_id == request.job_id,
            Application.candidate_id == current_user.id
        )
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this job"
        )
    
    # Validate resume if provided
    if request.resume_id:
        resume = session.get(Resume, request.resume_id)
        if not resume or resume.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid resume"
            )
    
    # Create application
    application = Application(
        job_id=request.job_id,
        candidate_id=current_user.id,
        resume_id=request.resume_id,
        status=ApplicationStatus.RECEIVED
    )
    
    session.add(application)
    session.commit()
    session.refresh(application)
    
    return ApplicationResponse(
        id=application.id,
        job_id=application.job_id,
        job_title=job.title,
        candidate_id=application.candidate_id,
        candidate_name=current_user.username,
        resume_id=application.resume_id,
        status=application.status,
        match_score=application.match_score,
        is_shortlisted=application.is_shortlisted,
        applied_at=application.applied_at,
        updated_at=application.updated_at
    )


@router.get(
    "/",
    response_model=ApplicationListResponse,
    summary="List applications",
    description="""
    List job applications.
    
    **Candidates:** See only their own applications
    **Recruiters/Admins:** See all applications
    """
)
def list_applications(
    job_id: int = None,
    page: int = 1,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """List applications based on user role."""
    query = select(Application)
    
    # Filter by role
    if not current_user.has_permission("view_all_applications"):
        query = query.where(Application.candidate_id == current_user.id)
    
    # Filter by job if specified
    if job_id:
        query = query.where(Application.job_id == job_id)
    
    query = query.order_by(Application.applied_at.desc())
    
    # Pagination
    total = len(session.exec(query).all())
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    skip = (page - 1) * limit
    
    applications = session.exec(query.offset(skip).limit(limit)).all()
    
    result = []
    for app in applications:
        job = session.get(JobRequisition, app.job_id)
        candidate = session.get(User, app.candidate_id)
        
        result.append(ApplicationResponse(
            id=app.id,
            job_id=app.job_id,
            job_title=job.title if job else None,
            candidate_id=app.candidate_id,
            candidate_name=candidate.username if candidate else None,
            resume_id=app.resume_id,
            status=app.status,
            match_score=app.match_score,
            is_shortlisted=app.is_shortlisted,
            applied_at=app.applied_at,
            updated_at=app.updated_at
        ))
    
    return ApplicationListResponse(
        applications=result, 
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.get(
    "/my-applications",
    response_model=CandidateApplicationList,
    summary="My applications",
    description="Get your application timeline (Candidate view)."
)
def get_my_applications(
    page: int = 1,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get candidate's applications with status timeline."""
    query = select(Application).where(Application.candidate_id == current_user.id).order_by(Application.applied_at.desc())
    
    total = len(session.exec(query).all())
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    skip = (page - 1) * limit
    
    applications = session.exec(query.offset(skip).limit(limit)).all()
    
    result = []
    for app in applications:
        job = session.get(JobRequisition, app.job_id)
        if job:
            result.append(CandidateApplicationResponse(
                id=app.id,
                job_id=app.job_id,
                job_title=job.title,
                company_department=job.department,
                location=job.location,
                status=app.status,
                applied_at=app.applied_at,
                updated_at=app.updated_at
            ))
    
    return CandidateApplicationList(
        applications=result,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


@router.get(
    "/{application_id}",
    response_model=ApplicationResponse,
    summary="Get application details"
)
def get_application(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Get application details."""
    application = session.get(Application, application_id)
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check access
    if not current_user.has_permission("view_all_applications"):
        if application.candidate_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    job = session.get(JobRequisition, application.job_id)
    candidate = session.get(User, application.candidate_id)
    
    return ApplicationResponse(
        id=application.id,
        job_id=application.job_id,
        job_title=job.title if job else None,
        candidate_id=application.candidate_id,
        candidate_name=candidate.username if candidate else None,
        resume_id=application.resume_id,
        status=application.status,
        match_score=application.match_score,
        is_shortlisted=application.is_shortlisted,
        applied_at=application.applied_at,
        updated_at=application.updated_at
    )


@router.patch(
    "/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Update application status",
    description="Update the status of an application. **Requires 'manage_applications' permission.**"
)
def update_application_status(
    application_id: int,
    request: ApplicationStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    """Update application status (recruiter action)."""
    application = session.get(Application, application_id)
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    application.status = request.status
    application.updated_at = datetime.utcnow()
    
    if request.notes:
        application.notes = request.notes
    
    session.commit()
    session.refresh(application)
    
    job = session.get(JobRequisition, application.job_id)
    candidate = session.get(User, application.candidate_id)
    
    return ApplicationResponse(
        id=application.id,
        job_id=application.job_id,
        job_title=job.title if job else None,
        candidate_id=application.candidate_id,
        candidate_name=candidate.username if candidate else None,
        resume_id=application.resume_id,
        status=application.status,
        match_score=application.match_score,
        is_shortlisted=application.is_shortlisted,
        applied_at=application.applied_at,
        updated_at=application.updated_at
    )


@router.patch(
    "/{application_id}/shortlist",
    response_model=ApplicationResponse,
    summary="Toggle shortlist status",
    description="Toggle shortlist on/off for an application. **Requires 'manage_applications' permission.**"
)
def toggle_shortlist(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    """Toggle shortlist status for a candidate application."""
    application = session.get(Application, application_id)
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    application.is_shortlisted = not application.is_shortlisted
    application.updated_at = datetime.utcnow()
    
    session.commit()
    session.refresh(application)
    
    job = session.get(JobRequisition, application.job_id)
    candidate = session.get(User, application.candidate_id)
    
    return ApplicationResponse(
        id=application.id,
        job_id=application.job_id,
        job_title=job.title if job else None,
        candidate_id=application.candidate_id,
        candidate_name=candidate.username if candidate else None,
        resume_id=application.resume_id,
        status=application.status,
        match_score=application.match_score,
        is_shortlisted=application.is_shortlisted,
        applied_at=application.applied_at,
        updated_at=application.updated_at
    )


@router.delete(
    "/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove candidate record",
    description="Delete an application/candidate record. **Requires 'manage_users' permission.**"
)
def remove_application(
    application_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users"))
):
    """Remove an application record from the system."""
    application = session.get(Application, application_id)

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    session.delete(application)
    session.commit()
