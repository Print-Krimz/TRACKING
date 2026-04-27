from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from dependencies import check_permissions, get_current_user
from models.application import Application
from models.application_interview import (
    ApplicationInterview,
    InterviewMode,
    InterviewStatus,
)
from models.notification import NotificationType
from models.user import User
from schemas.interview import InterviewListResponse, InterviewResponse, InterviewUpdateRequest
from services.audit_service import log_audit
from services.notification_service import create_notification

router = APIRouter(
    prefix="/interviews",
    tags=["Interviews"],
    responses={401: {"description": "Not authenticated"}},
)


@router.patch("/{interview_id}", response_model=InterviewResponse)
def update_interview(
    interview_id: int,
    request: InterviewUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    interview = session.get(ApplicationInterview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    application = session.get(Application, interview.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    wants_reschedule = request.scheduled_start_at or request.scheduled_end_at
    if wants_reschedule:
        new_start = request.scheduled_start_at or interview.scheduled_start_at
        new_end = request.scheduled_end_at or interview.scheduled_end_at
        if new_end <= new_start:
            raise HTTPException(status_code=400, detail="End time must be after start time.")

        interview.status = InterviewStatus.RESCHEDULED
        interview.updated_at = datetime.utcnow()
        session.add(interview)

        new_interview = ApplicationInterview(
            application_id=interview.application_id,
            scheduled_by_user_id=current_user.id,
            interviewer_user_id=request.interviewer_user_id or interview.interviewer_user_id,
            scheduled_start_at=new_start,
            scheduled_end_at=new_end,
            timezone=request.timezone or interview.timezone,
            mode=request.mode or interview.mode,
            location_or_link=request.location_or_link or interview.location_or_link,
            notes=request.notes if request.notes is not None else interview.notes,
            status=InterviewStatus.SCHEDULED,
        )
        session.add(new_interview)
        target = new_interview
        action = "RESCHEDULE_INTERVIEW"
    else:
        if request.status is not None:
            interview.status = request.status
        if request.interviewer_user_id is not None:
            interview.interviewer_user_id = request.interviewer_user_id
        if request.timezone is not None:
            interview.timezone = request.timezone
        if request.mode is not None:
            interview.mode = request.mode
        if request.location_or_link is not None:
            interview.location_or_link = request.location_or_link
        if request.notes is not None:
            interview.notes = request.notes
        interview.updated_at = datetime.utcnow()
        session.add(interview)
        target = interview
        action = "UPDATE_INTERVIEW"

    log_audit(
        session=session,
        user_id=current_user.id,
        action=action,
        entity_type="ApplicationInterview",
        entity_id=interview_id,
        details=f"application_id={interview.application_id}",
    )
    create_notification(
        session=session,
        user_id=application.candidate_id,
        type=NotificationType.INFO,
        message=f"Interview updated for application #{interview.application_id}.",
        link="/my-applications",
    )

    session.commit()
    session.refresh(target)
    return target


@router.get("/upcoming", response_model=InterviewListResponse)
def get_upcoming_interviews(
    from_date: Optional[datetime] = Query(default=None, alias="from"),
    to_date: Optional[datetime] = Query(default=None, alias="to"),
    status: Optional[InterviewStatus] = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not (
        current_user.has_permission("manage_applications")
        or current_user.has_permission("view_analytics")
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(ApplicationInterview)
    if from_date:
        query = query.where(ApplicationInterview.scheduled_start_at >= from_date)
    if to_date:
        query = query.where(ApplicationInterview.scheduled_start_at <= to_date)
    if status:
        query = query.where(ApplicationInterview.status == status)
    else:
        query = query.where(
            ApplicationInterview.status.in_(
                [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]
            )
        )

    interviews = session.exec(
        query.order_by(ApplicationInterview.scheduled_start_at.asc())
    ).all()
    return {"interviews": interviews, "total": len(interviews)}
