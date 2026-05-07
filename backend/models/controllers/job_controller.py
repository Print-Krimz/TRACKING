"""
Job Controller

Business logic for job requisition operations including CRUD,
filtering, and AI-powered keyword extraction.

RBAC Rules:
- Recruiters/Admins can create, update, delete jobs (manage_jobs permission)
- All authenticated users can view jobs
- Candidates see only OPEN jobs; Recruiters/Admins see all
"""

import os
import json
from typing import List, Optional
from datetime import datetime, timezone

from sqlmodel import Session, select
from sqlalchemy import func

from models.user import User
from models.job import JobRequisition, JobCriteria, JobKeyword, JobStatus
from schemas.job import (
    JobCreateRequest,
    JobUpdateRequest,
    JobResponse,
    JobCriteriaResponse,
    JobKeywordResponse,
)
from services.automation_flags import is_automation_enabled
from services.audit_service import log_audit
from services.automation_job_service import enqueue_automation_job


# =============================================================================
# Helper: convert a JobRequisition ORM object to a JobResponse schema
# =============================================================================

def _to_response(job: JobRequisition) -> JobResponse:
    """Convert a JobRequisition model to a JobResponse schema."""
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        department=job.department,
        location=job.location,
        employment_type=job.employment_type,
        experience_years=job.experience_years,
        education_level=job.education_level,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        salary_currency=job.salary_currency,
        status=job.status,
        created_by=job.created_by,
        created_at=job.created_at,
        updated_at=job.updated_at,
        criteria=[
            JobCriteriaResponse(
                id=c.id,
                skill_name=c.skill_name,
                is_must_have=c.is_must_have,
                weight=c.weight,
            )
            for c in (job.criteria or [])
        ],
        keywords=[
            JobKeywordResponse(
                id=k.id,
                keyword=k.keyword,
                category=k.category,
            )
            for k in (job.keywords or [])
        ],
    )


# =============================================================================
# CRUD Functions
# =============================================================================

def create_job(
    session: Session,
    current_user: User,
    request: JobCreateRequest,
) -> JobResponse:
    """
    Create a new job requisition.

    RBAC Requirement:
        Permission: 'manage_jobs' (Recruiter/Admin)

    Args:
        session: Database session
        current_user: The authenticated user (must be Recruiter/Admin)
        request: Job creation data

    Returns:
        JobResponse: The created job data
    """
    job = JobRequisition(
        title=request.title,
        description=request.description,
        department=request.department,
        location=request.location,
        employment_type=request.employment_type,
        experience_years=request.experience_years,
        education_level=request.education_level,
        salary_min=request.salary_min,
        salary_max=request.salary_max,
        salary_currency=request.salary_currency,
        status=request.status or JobStatus.OPEN,
        created_by=current_user.id,
    )

    session.add(job)
    session.commit()
    session.refresh(job)

    # Add criteria if provided
    for crit in request.criteria:
        criteria = JobCriteria(
            job_id=job.id,
            skill_name=crit.skill_name,
            is_must_have=crit.is_must_have,
            weight=crit.weight,
        )
        session.add(criteria)

    if request.criteria:
        session.commit()
        session.refresh(job)

    if job.status == JobStatus.OPEN and is_automation_enabled("pool_autorescan"):
        try:
            enqueue_automation_job(
                session=session,
                job_type="talent_pool_rescan",
                payload={"target_job_id": job.id, "trigger_type": "job_created"},
                actor_user_id=current_user.id,
                idempotency_key=f"job-created-rescan:{job.id}",
            )
        except Exception:
            pass

    log_audit(
        session=session,
        user_id=current_user.id,
        action="CREATE_JOB",
        entity_type="JobRequisition",
        entity_id=job.id,
        details=f"Created job '{job.title}'",
        before_state=None,
        after_state=json.dumps(
            {
                "title": job.title,
                "status": job.status.value if hasattr(job.status, "value") else job.status,
                "criteria_count": len(job.criteria or []),
            }
        ),
    )
    session.commit()

    return _to_response(job)


def get_jobs(
    session: Session,
    current_user: User,
    status_filter: Optional[JobStatus] = None,
    include_closed: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[JobResponse], int, int]:
    """
    Retrieve jobs based on user role.

    RBAC Logic:
        - Recruiters/Admins see all jobs (optional status filter)
        - Candidates/Applicants see only OPEN jobs

    Args:
        session: Database session
        current_user: The authenticated user
        status_filter: Optional status to filter by
        include_closed: Whether to include closed/filled jobs

    Returns:
        List[JobResponse]: List of accessible jobs
    """
    statement = select(JobRequisition)

    is_manager = current_user.has_permission("manage_jobs")

    if is_manager:
        # Recruiters/Admins: optional filtering
        if status_filter:
            statement = statement.where(JobRequisition.status == status_filter)
        elif not include_closed:
            statement = statement.where(
                JobRequisition.status.notin_([JobStatus.CLOSED, JobStatus.FILLED])
            )
    else:
        # Candidates only see OPEN jobs
        statement = statement.where(JobRequisition.status == JobStatus.OPEN)

    statement = statement.order_by(JobRequisition.created_at.desc())
    
    # Get total count before pagination
    total = len(session.exec(statement).all())
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    
    # Apply pagination
    statement = statement.offset(skip).limit(limit)
    jobs = session.exec(statement).all()

    return [_to_response(job) for job in jobs], total, total_pages


def get_job_by_id(
    session: Session,
    job_id: int,
    current_user: User,
) -> JobResponse:
    """
    Retrieve a specific job by ID.

    RBAC Logic:
        - Recruiters/Admins can view any job
        - Candidates can only view OPEN jobs

    Raises:
        ValueError: If job not found or access denied
    """
    job = session.get(JobRequisition, job_id)

    if not job:
        raise ValueError(f"Job with ID {job_id} not found")

    before_state = {
        "title": job.title,
        "description": job.description,
        "department": job.department,
        "location": job.location,
        "employment_type": job.employment_type,
        "experience_years": job.experience_years,
        "education_level": job.education_level,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "salary_currency": job.salary_currency,
        "status": job.status.value if hasattr(job.status, "value") else job.status,
        "criteria_count": len(job.criteria or []),
    }

    # Candidates can only view open jobs
    if not current_user.has_permission("manage_jobs"):
        if job.status != JobStatus.OPEN:
            raise ValueError(f"Job with ID {job_id} not found")

    return _to_response(job)


def update_job(
    session: Session,
    job_id: int,
    current_user: User,
    request: JobUpdateRequest,
) -> JobResponse:
    """
    Update a job requisition.

    RBAC Requirement:
        Permission: 'manage_jobs' (Recruiter/Admin)

    Raises:
        ValueError: If job not found
    """
    job = session.get(JobRequisition, job_id)

    if not job:
        raise ValueError(f"Job with ID {job_id} not found")

    # Update only provided fields
    update_data = request.model_dump(exclude_unset=True, exclude={"criteria"})
    # Check if description is being updated to trigger keyword re-extraction
    description_changed = False
    if "description" in update_data and update_data["description"] != job.description:
        description_changed = True

    for key, value in update_data.items():
        setattr(job, key, value)

    job.updated_at = datetime.now(timezone.utc)

    # Update criteria if provided
    if request.criteria is not None:
        # Remove existing criteria
        for c in list(job.criteria):
            session.delete(c)

        # Add new criteria
        for crit in request.criteria:
            criteria = JobCriteria(
                job_id=job.id,
                skill_name=crit.skill_name,
                is_must_have=crit.is_must_have,
                weight=crit.weight,
            )
            session.add(criteria)

    session.add(job)
    session.commit()
    session.refresh(job)

    # Re-extract keywords if description changed
    if description_changed:
        try:
            extract_keywords(session, job.id, current_user)
            # Re-fetch or refresh to get the new keywords in the response
            session.refresh(job)
        except Exception:
            # Don't fail the update if keyword extraction fails
            pass

    if job.status == JobStatus.OPEN and is_automation_enabled("pool_autorescan") and (
        description_changed
        or request.criteria is not None
        or "status" in update_data
    ):
        try:
            enqueue_automation_job(
                session=session,
                job_type="talent_pool_rescan",
                payload={"target_job_id": job.id, "trigger_type": "job_criteria_updated"},
                actor_user_id=current_user.id,
                idempotency_key=f"job-updated-rescan:{job.id}:{int(description_changed)}:{int(request.criteria is not None)}:{int('status' in update_data)}",
            )
        except Exception:
            pass

    log_audit(
        session=session,
        user_id=current_user.id,
        action="UPDATE_JOB",
        entity_type="JobRequisition",
        entity_id=job.id,
        details=f"Updated job '{job.title}'",
        before_state=json.dumps(before_state),
        after_state=json.dumps(
            {
                "title": job.title,
                "description": job.description,
                "department": job.department,
                "location": job.location,
                "employment_type": job.employment_type,
                "experience_years": job.experience_years,
                "education_level": job.education_level,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "salary_currency": job.salary_currency,
                "status": job.status.value if hasattr(job.status, "value") else job.status,
                "criteria_count": len(job.criteria or []),
            }
        ),
    )
    session.commit()

    return _to_response(job)


def delete_job(
    session: Session,
    job_id: int,
    current_user: User,
) -> bool:
    """
    Delete a job requisition.

    RBAC Requirement:
        Permission: 'manage_jobs' (Recruiter/Admin)

    Raises:
        ValueError: If job not found
    """
    job = session.get(JobRequisition, job_id)

    if not job:
        raise ValueError(f"Job with ID {job_id} not found")

    before_state = {
        "title": job.title,
        "status": job.status.value if hasattr(job.status, "value") else job.status,
    }

    session.delete(job)
    session.commit()

    log_audit(
        session=session,
        user_id=current_user.id,
        action="DELETE_JOB",
        entity_type="JobRequisition",
        entity_id=job_id,
        details=f"Deleted job '{job.title}'",
        before_state=json.dumps(before_state),
        after_state=None,
    )
    session.commit()

    return True


# =============================================================================
# AI Keyword Extraction
# =============================================================================

def extract_keywords(
    session: Session,
    job_id: int,
    current_user: User,
) -> List[JobKeywordResponse]:
    """
    Use Gemini AI to extract keywords from a job description.

    This deletes any previously extracted keywords for the job,
    then calls Gemini to generate new ones.

    RBAC Requirement:
        Permission: 'manage_jobs' (Recruiter/Admin)

    Raises:
        ValueError: If job not found or Gemini is unavailable
    """
    job = session.get(JobRequisition, job_id)

    if not job:
        raise ValueError(f"Job with ID {job_id} not found")

    # Remove existing keywords
    for kw in list(job.keywords):
        session.delete(kw)
    session.commit()

    # Try to use Gemini for keyword extraction
    try:
        import google.generativeai as genai
        from dotenv import load_dotenv

        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-flash-latest")

        prompt = f"""
Analyze the following job description and extract important keywords.
Categorize each keyword as one of: skill, tool, concept, qualification.

JOB TITLE: {job.title}
JOB DESCRIPTION:
{job.description}

Return your answer as a JSON array of objects, each with "keyword" and "category" fields.
Return ONLY the JSON array, no additional text.

Example:
[
    {{"keyword": "Python", "category": "skill"}},
    {{"keyword": "Docker", "category": "tool"}}
]
"""
        response = model.generate_content(prompt)
        text = response.text

        # Parse JSON from possible markdown blocks
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            text = text[start:end].strip()

        keywords_data = json.loads(text)

    except Exception:
        # Fallback: simple keyword extraction from title and criteria
        keywords_data = []
        # Extract from title words
        for word in job.title.split():
            if len(word) > 2:
                keywords_data.append({"keyword": word, "category": "concept"})
        # Extract from criteria
        for c in (job.criteria or []):
            keywords_data.append({"keyword": c.skill_name, "category": "skill"})

    # Save extracted keywords to database
    saved_keywords = []
    seen = set()
    for kw_data in keywords_data:
        keyword_text = kw_data.get("keyword", "").strip()
        if not keyword_text or keyword_text.lower() in seen:
            continue
        seen.add(keyword_text.lower())

        kw = JobKeyword(
            job_id=job.id,
            keyword=keyword_text,
            category=kw_data.get("category"),
        )
        session.add(kw)
        saved_keywords.append(kw)

    session.commit()

    # Refresh to get IDs
    for kw in saved_keywords:
        session.refresh(kw)

    return [
        JobKeywordResponse(id=kw.id, keyword=kw.keyword, category=kw.category)
        for kw in saved_keywords
    ]
