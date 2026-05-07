import json
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlmodel import Session, select

from models.application import Application
from models.application_interview import ApplicationInterview
from models.application_interview import InterviewStatus
from models.document import Document
from models.notification import NotificationType
from services.audit_service import log_audit
from services.automation_heuristics import (
    build_job_draft,
    extract_document_metadata,
    suggest_interview_slots,
)
from services.automation_job_service import register_automation_handler
from services.notification_service import create_notification
from services.report_schedule_service import deliver_report_schedule
from services.talent_pool_service import bulk_rescan_talent_pool, rescan_talent_pool_entry


@register_automation_handler("job_autofill")
def handle_job_autofill(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    del session, actor_user_id, actor_type
    return build_job_draft(
        title=payload.get("title") or "",
        description_text=payload.get("description_text") or "",
        target_role=payload.get("target_role"),
    )


@register_automation_handler("bulk_pipeline_status")
def handle_bulk_pipeline_status(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    application_ids = payload.get("application_ids") or []
    target_status = payload.get("status")
    notes = payload.get("notes")
    results = []

    for application_id in application_ids:
        application = session.get(Application, application_id)
        if not application:
            results.append({"application_id": application_id, "success": False, "error": "Application not found"})
            continue

        before = {"status": application.status.value if hasattr(application.status, "value") else application.status}
        application.status = target_status
        if notes is not None:
            application.notes = notes
        application.updated_at = datetime.utcnow()
        session.add(application)
        log_audit(
            session=session,
            user_id=actor_user_id,
            actor_type=actor_type,
            action="BULK_APPLICATION_STATUS",
            entity_type="Application",
            entity_id=application.id,
            details=f"Bulk status update to {target_status}",
            before_state=json.dumps(before),
            after_state=json.dumps({"status": target_status, "notes": notes}),
        )
        create_notification(
            session=session,
            user_id=application.candidate_id,
            type=NotificationType.INFO,
            message=f"Your application status was updated to {target_status}.",
            link="/my-applications",
        )
        results.append({"application_id": application_id, "success": True, "status": target_status})

    session.commit()
    return {
        "total": len(application_ids),
        "succeeded": len([item for item in results if item["success"]]),
        "failed": len([item for item in results if not item["success"]]),
        "results": results,
    }


@register_automation_handler("bulk_pipeline_shortlist")
def handle_bulk_pipeline_shortlist(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    application_ids = payload.get("application_ids") or []
    shortlisted = bool(payload.get("shortlisted", True))
    results = []

    for application_id in application_ids:
        application = session.get(Application, application_id)
        if not application:
            results.append({"application_id": application_id, "success": False, "error": "Application not found"})
            continue

        before = {"is_shortlisted": application.is_shortlisted}
        application.is_shortlisted = shortlisted
        application.updated_at = datetime.utcnow()
        session.add(application)
        log_audit(
            session=session,
            user_id=actor_user_id,
            actor_type=actor_type,
            action="BULK_APPLICATION_SHORTLIST",
            entity_type="Application",
            entity_id=application.id,
            details=f"Bulk shortlist set to {shortlisted}",
            before_state=json.dumps(before),
            after_state=json.dumps({"is_shortlisted": shortlisted}),
        )
        create_notification(
            session=session,
            user_id=application.candidate_id,
            type=NotificationType.INFO,
            message=f"Your application was {'shortlisted' if shortlisted else 'removed from shortlist'}.",
            link="/my-applications",
        )
        results.append({"application_id": application_id, "success": True, "status": "shortlisted" if shortlisted else "not_shortlisted"})

    session.commit()
    return {
        "total": len(application_ids),
        "succeeded": len([item for item in results if item["success"]]),
        "failed": len([item for item in results if not item["success"]]),
        "results": results,
    }


@register_automation_handler("talent_pool_rescan")
def handle_talent_pool_rescan(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    del actor_type
    target_job_id = payload.get("target_job_id")
    entry_ids = payload.get("entry_ids")
    trigger_type = payload.get("trigger_type", "manual")
    entries = bulk_rescan_talent_pool(
        session,
        target_job_id=target_job_id,
        entry_ids=entry_ids,
        recruiter_id=actor_user_id,
        trigger_type=trigger_type,
    )
    updates = [entry["entry"] for entry in entries]
    matched = len([entry for entry in updates if entry.matched_open_jobs_count > 0])
    return {
        "rescanned_count": len([entry for entry in entries if not entry.get("skipped")]),
        "matched_entries": matched,
        "skipped_count": len([entry for entry in entries if entry.get("skipped")]),
        "entries": [entry.model_dump() for entry in updates],
        "deltas": [entry["delta"] for entry in entries],
    }


@register_automation_handler("interview_suggest_slots")
def handle_interview_suggest_slots(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    del actor_user_id, actor_type
    application_id = payload.get("application_id")
    existing_windows: list[tuple[datetime, datetime]] = []
    if application_id:
        interviews = session.exec(
            select(ApplicationInterview)
            .where(ApplicationInterview.application_id == application_id)
            .where(ApplicationInterview.status.in_([InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]))
        ).all()
        existing_windows = [
            (interview.scheduled_start_at, interview.scheduled_end_at)
            for interview in interviews
            if interview.scheduled_start_at and interview.scheduled_end_at
        ]
    slots = suggest_interview_slots(
        existing_windows=existing_windows,
        timezone_name=payload.get("timezone", "UTC"),
        duration_minutes=int(payload.get("duration_minutes", 60)),
        window_days=int(payload.get("window_days", 5)),
        slot_count=int(payload.get("slot_count", 3)),
    )
    return {"slots": slots}


@register_automation_handler("interview_send_invite")
def handle_interview_send_invite(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    interview_id = payload.get("interview_id")
    interview = session.get(ApplicationInterview, interview_id) if interview_id else None
    if not interview:
        return {"error": "Interview not found"}

    application = session.get(Application, interview.application_id)
    if not application:
        return {"error": "Application not found"}

    template = payload.get("template") or "Interview invite"
    notes = payload.get("notes")
    message = (
        f"{template}: Interview #{interview.id} for application #{application.id} is scheduled for "
        f"{interview.scheduled_start_at.isoformat()}."
    )
    if notes:
        message = f"{message} Notes: {notes}"

    create_notification(
        session=session,
        user_id=application.candidate_id,
        type=NotificationType.INFO,
        message=message,
        link="/my-applications",
    )
    log_audit(
        session=session,
        user_id=actor_user_id,
        actor_type=actor_type,
        action="SEND_INTERVIEW_INVITE",
        entity_type="ApplicationInterview",
        entity_id=interview.id,
        details=message,
        before_state=json.dumps({"status": interview.status.value if hasattr(interview.status, "value") else interview.status}),
        after_state=json.dumps({"invite_sent": True}),
    )
    session.commit()
    return {"interview_id": interview.id, "message": message}


@register_automation_handler("document_metadata_extract")
def handle_document_metadata_extract(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    del actor_user_id, actor_type
    doc_id = payload.get("doc_id")
    document = session.get(Document, doc_id) if doc_id else None
    if not document:
        return {"error": "Document not found"}
    extracted = extract_document_metadata(
        document.original_filename,
        payload.get("file_text", ""),
        document.document_type,
    )
    document.document_type_candidate = extracted["document_type_candidate"]
    document.expiration_date_candidate = (
        datetime.fromisoformat(extracted["expiry_date_candidate"])
        if extracted["expiry_date_candidate"]
        else document.expiration_date
    )
    document.extraction_confidence = extracted["confidence"]
    session.add(document)
    session.commit()
    session.refresh(document)
    return extracted | {
        "doc_id": document.id,
        "document_type": document.document_type,
        "metadata_confirmed": document.metadata_confirmed,
    }


@register_automation_handler("scheduled_report_delivery")
def handle_scheduled_report_delivery(session: Session, payload: dict[str, Any], actor_user_id: Optional[int], actor_type: str) -> dict[str, Any]:
    schedule_id = payload.get("schedule_id")
    if not schedule_id:
        return {"error": "Report schedule not found"}
    return deliver_report_schedule(session, int(schedule_id), actor_user_id, actor_type)
