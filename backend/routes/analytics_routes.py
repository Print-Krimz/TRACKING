"""
Analytics Routes

API endpoints for recruiter analytics and metrics.
"""

import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from typing import Optional

from database import get_session
from dependencies import check_permissions
from models.user import User
from models.job import JobRequisition, JobStatus
from models.application import Application, ApplicationStatus
from models.report_schedule import ReportSchedule
from schemas.automation import (
    ReportScheduleCreateRequest,
    ReportScheduleListResponse,
    ReportScheduleResponse,
)
from schemas.report import ReportRequest


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    responses={401: {"description": "Not authenticated"}}
)


def _schedule_to_response(schedule: ReportSchedule) -> ReportScheduleResponse:
    return ReportScheduleResponse(
        id=schedule.id,
        name=schedule.name,
        report_type=schedule.report_type,
        format=schedule.format,
        cadence=schedule.cadence,
        job_id=schedule.job_id,
        date_from=schedule.date_from,
        date_to=schedule.date_to,
        delivery_channel=schedule.delivery_channel,
        recipient_email=schedule.recipient_email,
        config=json.loads(schedule.config_json or "{}"),
        is_active=schedule.is_active,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


def _next_run_at(cadence: str) -> Optional[datetime]:
    now = datetime.utcnow()
    if cadence == "daily":
        return now + timedelta(days=1)
    if cadence == "weekly":
        return now + timedelta(days=7)
    if cadence == "monthly":
        return now + timedelta(days=30)
    return None


@router.get(
    "/overview",
    summary="Dashboard overview",
    description="Get key metrics for recruiter dashboard. **Requires 'view_analytics' permission.**"
)
def get_overview(
    job_id: Optional[int] = Query(default=None, description="Optional Job ID to filter metrics"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Get dashboard overview metrics."""
    
    # Total open jobs
    open_jobs_query = select(func.count(JobRequisition.id)).where(JobRequisition.status == JobStatus.OPEN)
    if job_id:
        open_jobs_query = open_jobs_query.where(JobRequisition.id == job_id)
    open_jobs = session.exec(open_jobs_query).one()
    
    # Total applications
    apps_query = select(func.count(Application.id))
    if job_id:
        apps_query = apps_query.where(Application.job_id == job_id)
    total_applications = session.exec(apps_query).one()
    
    # Applications by status
    status_counts = {}
    for status in ApplicationStatus:
        status_query = select(func.count(Application.id)).where(Application.status == status)
        if job_id:
            status_query = status_query.where(Application.job_id == job_id)
        count = session.exec(status_query).one()
        status_counts[status.value] = count
    
    # Recent applications (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_query = select(func.count(Application.id)).where(Application.applied_at >= week_ago)
    if job_id:
        recent_query = recent_query.where(Application.job_id == job_id)
    recent_apps = session.exec(recent_query).one()
    
    return {
        "open_jobs": open_jobs,
        "total_applications": total_applications,
        "applications_by_status": status_counts,
        "recent_applications": recent_apps,
        "pipeline": {
            "new": status_counts.get("received", 0),
            "screening": status_counts.get("screening", 0),
            "interview": status_counts.get("interview", 0),
            "offer": status_counts.get("offer", 0),
        }
    }


@router.get(
    "/time-to-hire",
    summary="Time to hire metrics",
    description="Calculate average time to hire. **Requires 'view_analytics' permission.**"
)
def get_time_to_hire(
    days: int = Query(default=90, description="Time period in days"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Calculate time to hire metrics."""
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Get hired applications
    hired_apps = session.exec(
        select(Application)
        .where(Application.status == ApplicationStatus.HIRED)
        .where(Application.updated_at >= start_date)
    ).all()
    
    if not hired_apps:
        return {
            "average_days": 0,
            "total_hires": 0,
            "period_days": days
        }
    
    total_days = 0
    for app in hired_apps:
        days_to_hire = (app.updated_at - app.applied_at).days
        total_days += days_to_hire
    
    return {
        "average_days": round(total_days / len(hired_apps), 1),
        "total_hires": len(hired_apps),
        "period_days": days
    }


@router.get(
    "/pipeline-by-job",
    summary="Pipeline breakdown by job",
    description="Get application counts grouped by job. **Requires 'view_analytics' permission.**"
)
def get_pipeline_by_job(
    limit: int = Query(default=10, description="Number of jobs to return"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Get pipeline breakdown by job requisition."""
    
    # Get open jobs with their application counts
    jobs = session.exec(
        select(JobRequisition)
        .where(JobRequisition.status == JobStatus.OPEN)
        .limit(limit)
    ).all()
    
    result = []
    for job in jobs:
        # Count applications by status for this job
        apps = session.exec(
            select(Application)
            .where(Application.job_id == job.id)
        ).all()
        
        status_breakdown = {}
        for status in ApplicationStatus:
            status_breakdown[status.value] = len([a for a in apps if a.status == status])
        
        result.append({
            "job_id": job.id,
            "job_title": job.title,
            "department": job.department,
            "total_applications": len(apps),
            "breakdown": status_breakdown
        })
    
    # Sort by total applications descending
    result.sort(key=lambda x: x["total_applications"], reverse=True)
    
    return {"jobs": result}


@router.get(
    "/trends",
    summary="Application trends",
    description="Get application trends over time. **Requires 'view_analytics' permission.**"
)
def get_trends(
    days: int = Query(default=30, description="Time period in days"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Get daily application counts for trend chart."""
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    applications = session.exec(
        select(Application)
        .where(Application.applied_at >= start_date)
        .order_by(Application.applied_at)
    ).all()
    
    # Group by date
    daily_counts = {}
    for app in applications:
        date_key = app.applied_at.strftime("%Y-%m-%d")
        daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
    
    # Fill in missing dates with 0
    result = []
    current_date = start_date
    while current_date <= datetime.utcnow():
        date_key = current_date.strftime("%Y-%m-%d")
        result.append({
            "date": date_key,
            "count": daily_counts.get(date_key, 0)
        })
        current_date += timedelta(days=1)
    
    return {"trends": result, "period_days": days}


@router.get(
    "/skill-distribution",
    summary="Skill distribution among applicants",
    description="Get skill frequency across applicants. **Requires 'view_analytics' permission.**"
)
def get_skill_distribution(
    job_id: Optional[int] = Query(default=None, description="Optional Job ID to filter skills"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Analyze skill distribution across applicants by matching job criteria against resume content."""
    from models.job import JobCriteria
    from models.resume import Resume

    # Collect all required skills from open jobs (or specific job)
    crit_query = select(JobCriteria).join(JobRequisition, JobCriteria.job_id == JobRequisition.id).where(JobRequisition.status == JobStatus.OPEN)
    if job_id:
        crit_query = crit_query.where(JobRequisition.id == job_id)
        
    criteria = session.exec(crit_query).all()

    skill_counts = {}
    for c in criteria:
        name = c.skill_name.lower().strip()
        if name not in skill_counts:
            skill_counts[name] = {"required": 0, "matched": 0, "label": c.skill_name}
        skill_counts[name]["required"] += 1

    # Get resumes linked to applications
    app_query = select(Application).where(Application.resume_id.isnot(None))
    if job_id:
        app_query = app_query.where(Application.job_id == job_id)
        
    applications = session.exec(app_query).all()

    resume_ids = list(set(a.resume_id for a in applications if a.resume_id))

    if resume_ids and skill_counts:
        resumes = session.exec(
            select(Resume).where(Resume.id.in_(resume_ids))
        ).all()

        # Match skills against resume content (case-insensitive keyword search)
        for resume in resumes:
            content_lower = (resume.content or "").lower()
            for skill_name in skill_counts:
                if skill_name in content_lower:
                    skill_counts[skill_name]["matched"] += 1

    # Sort by total relevance (required + matched)
    sorted_skills = sorted(
        skill_counts.values(),
        key=lambda x: x["required"] + x["matched"],
        reverse=True
    )[:15]

    return {"skills": sorted_skills}


@router.get(
    "/alerts",
    summary="Dashboard Actionable Alerts",
    description="Get intelligent alerts about stalled applications or jobs. **Requires 'view_analytics' permission.**"
)
def get_dashboard_alerts(
    job_id: Optional[int] = Query(default=None, description="Optional Job ID to filter alerts"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Generate intelligent alerts for the dashboard."""
    alerts = []
    
    # Alert 1: New applications waiting > 3 days
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    new_apps_query = select(Application).join(JobRequisition, Application.job_id == JobRequisition.id).where(
        Application.status == ApplicationStatus.RECEIVED,
        Application.updated_at <= three_days_ago
    )
    if job_id:
        new_apps_query = new_apps_query.where(Application.job_id == job_id)
        
    stale_new_apps = session.exec(new_apps_query).all()
    if stale_new_apps:
        alerts.append({
            "id": "stale_new",
            "type": "warning",
            "message": f"{len(stale_new_apps)} New candidates have been waiting over 3 days for initial screening.",
            "count": len(stale_new_apps)
        })

    # Alert 2: Interviewing candidates waiting > 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    interview_apps_query = select(Application).join(JobRequisition, Application.job_id == JobRequisition.id).where(
        Application.status == ApplicationStatus.INTERVIEW,
        Application.updated_at <= seven_days_ago
    )
    if job_id:
        interview_apps_query = interview_apps_query.where(Application.job_id == job_id)
        
    stale_interviews = session.exec(interview_apps_query).all()
    if stale_interviews:
        alerts.append({
            "id": "stale_interview",
            "type": "error",
            "message": f"{len(stale_interviews)} candidates have been in 'Interview' status for over 7 days without an update.",
            "count": len(stale_interviews)
        })

    # Alert 3: Open jobs with 0 applications
    if not job_id:
        open_jobs = session.exec(select(JobRequisition).where(JobRequisition.status == JobStatus.OPEN)).all()
        jobs_zero_apps = 0
        for job in open_jobs:
            app_count = session.exec(select(func.count(Application.id)).where(Application.job_id == job.id)).one()
            if app_count == 0:
                jobs_zero_apps += 1
                
        if jobs_zero_apps > 0:
            alerts.append({
                "id": "zero_apps_jobs",
                "type": "info",
                "message": f"{jobs_zero_apps} open jobs have received 0 applications so far.",
                "count": jobs_zero_apps
            })

        # Feature: Compliance Tracking / Document Alerts (Global, not job-tied)
        from models.document import Document
        now = datetime.utcnow()
        thirty_days_later = now + timedelta(days=30)
        
        # Expired Documents
        expired_docs_query = select(Document).where(Document.expiration_date < now)
        expired_docs = session.exec(expired_docs_query).all()
        if expired_docs:
            alerts.append({
                "id": "compliance_expired",
                "type": "error",
                "message": f"Compliance Alert: {len(expired_docs)} applicant documents (Contracts/IDs) have expired.",
                "count": len(expired_docs)
            })
            
        # Expiring Soon Documents (Next 30 Days)
        expiring_docs_query = select(Document).where(
            Document.expiration_date >= now,
            Document.expiration_date <= thirty_days_later
        )
        expiring_docs = session.exec(expiring_docs_query).all()
        if expiring_docs:
            alerts.append({
                "id": "compliance_expiring",
                "type": "warning",
                "message": f"Compliance Alert: {len(expiring_docs)} applicant documents are expiring within 30 days.",
                "count": len(expiring_docs)
            })

    return {"alerts": alerts}


# =============================================================================
# Report Generation Endpoints
# =============================================================================

@router.get(
    "/reports",
    summary="Available report types",
    description="List all available report types and their supported formats. **Requires 'view_analytics' permission.**"
)
def get_available_reports(
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """Return the list of available report types."""
    from services.report_service import REPORT_TYPES
    return {"report_types": REPORT_TYPES}


@router.post(
    "/reports/generate",
    summary="Generate a report",
    description="Generate a report in the specified format. Returns JSON data or a downloadable file (CSV/XLSX/PDF). **Requires 'view_analytics' permission.**"
)
def generate_report(
    request: ReportRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics"))
):
    """
    Generate a report based on the request parameters.

    - format=json: returns JSON with metadata and rows
    - format=csv/xlsx/pdf: returns a downloadable file
    """
    from fastapi.responses import Response
    from services.report_service import (
        REPORT_GENERATORS, FORMAT_CONVERTERS, REPORT_TITLES
    )

    # Validate report type
    if request.report_type not in REPORT_GENERATORS:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report type: '{request.report_type}'. Valid types: {list(REPORT_GENERATORS.keys())}"
        )

    # Validate format
    valid_formats = ["json", "csv", "xlsx", "pdf"]
    if request.format not in valid_formats:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format: '{request.format}'. Valid formats: {valid_formats}"
        )

    # Generate report data
    generator = REPORT_GENERATORS[request.report_type]
    kwargs = {}
    if request.job_id:
        kwargs["job_id"] = request.job_id
    if request.date_from:
        kwargs["date_from"] = request.date_from
    if request.date_to:
        kwargs["date_to"] = request.date_to

    columns, rows = generator(session, **kwargs)

    # Build metadata
    metadata = {
        "report_type": request.report_type,
        "generated_at": datetime.utcnow().isoformat(),
        "total_rows": len(rows),
        "filters": {
            "job_id": request.job_id,
            "date_from": request.date_from.isoformat() if request.date_from else None,
            "date_to": request.date_to.isoformat() if request.date_to else None,
        }
    }

    # Return JSON
    if request.format == "json":
        return {
            "metadata": metadata,
            "columns": columns,
            "rows": rows,
        }

    # Generate file
    title = REPORT_TITLES.get(request.report_type, "Report")
    converter = FORMAT_CONVERTERS[request.format]

    if request.format in ("csv", "xlsx"):
        file_bytes = converter(columns, rows)
    else:
        file_bytes = converter(columns, rows, title=title)

    # Content types
    content_types = {
        "csv": "text/csv; charset=utf-8",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pdf": "application/pdf",
    }
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{request.report_type}_report_{timestamp}.{request.format}"

    return Response(
        content=file_bytes,
        media_type=content_types[request.format],
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post(
    "/reports/schedules",
    response_model=ReportScheduleResponse,
    summary="Create a report schedule",
    description="Store a reusable scheduled report definition.",
)
def create_report_schedule(
    request: ReportScheduleCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics")),
):
    from fastapi import HTTPException
    from services.report_service import REPORT_GENERATORS

    valid_formats = ["json", "csv", "xlsx", "pdf"]
    valid_cadences = ["manual", "daily", "weekly", "monthly"]
    valid_delivery_channels = ["in_app", "email", "both"]

    if request.report_type not in REPORT_GENERATORS:
        raise HTTPException(status_code=400, detail=f"Invalid report type: '{request.report_type}'")
    if request.format not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Invalid format: '{request.format}'")
    if request.cadence not in valid_cadences:
        raise HTTPException(status_code=400, detail=f"Invalid cadence: '{request.cadence}'")
    if request.delivery_channel not in valid_delivery_channels:
        raise HTTPException(status_code=400, detail=f"Invalid delivery channel: '{request.delivery_channel}'")

    schedule = ReportSchedule(
        name=request.name,
        report_type=request.report_type,
        format=request.format,
        cadence=request.cadence,
        job_id=request.job_id,
        date_from=request.date_from,
        date_to=request.date_to,
        delivery_channel=request.delivery_channel,
        recipient_email=request.recipient_email,
        created_by_user_id=current_user.id,
        config_json=json.dumps(request.config or {}),
        next_run_at=_next_run_at(request.cadence),
    )
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return _schedule_to_response(schedule)


@router.get(
    "/reports/schedules",
    response_model=ReportScheduleListResponse,
    summary="List report schedules",
)
def list_report_schedules(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics")),
):
    schedules = session.exec(
        select(ReportSchedule).order_by(ReportSchedule.created_at.desc())
    ).all()
    return ReportScheduleListResponse(
        schedules=[_schedule_to_response(schedule) for schedule in schedules],
        total=len(schedules),
    )


@router.delete(
    "/reports/schedules/{schedule_id}",
    status_code=204,
    summary="Delete a report schedule",
)
def delete_report_schedule(
    schedule_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics")),
):
    schedule = session.get(ReportSchedule, schedule_id)
    if not schedule:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Report schedule not found")
    session.delete(schedule)
    session.commit()

