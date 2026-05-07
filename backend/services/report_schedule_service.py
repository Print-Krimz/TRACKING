import json
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any, Optional

from sqlmodel import Session, select

from models.notification import NotificationType
from models.report_schedule import ReportSchedule
from models.user import User
from services.audit_service import log_audit
from services.automation_flags import is_automation_enabled
from services.automation_job_service import enqueue_automation_job
from services.notification_service import create_notification
from services.report_service import FORMAT_CONVERTERS, REPORT_GENERATORS, REPORT_TITLES


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def _next_run_at(cadence: str, base_at: Optional[datetime] = None) -> Optional[datetime]:
    base = base_at or _utcnow()
    if cadence == "daily":
        return base + timedelta(days=1)
    if cadence == "weekly":
        return base + timedelta(days=7)
    if cadence == "monthly":
        return base + timedelta(days=30)
    return None


def _load_config(schedule: ReportSchedule) -> dict[str, Any]:
    try:
        return json.loads(schedule.config_json or "{}")
    except json.JSONDecodeError:
        return {}


def _resolve_report_args(schedule: ReportSchedule) -> dict[str, Any]:
    config = _load_config(schedule)
    return {
        "job_id": schedule.job_id if schedule.job_id is not None else config.get("job_id"),
        "date_from": schedule.date_from or _parse_datetime(config.get("date_from")),
        "date_to": schedule.date_to or _parse_datetime(config.get("date_to")),
    }


def _render_report(schedule: ReportSchedule, session: Session) -> tuple[dict[str, Any], list[str], list[dict[str, Any]]]:
    generator = REPORT_GENERATORS.get(schedule.report_type)
    if not generator:
        raise ValueError(f"Invalid report type: {schedule.report_type}")

    report_args = {key: value for key, value in _resolve_report_args(schedule).items() if value is not None}
    columns, rows = generator(session, **report_args)
    metadata = {
        "report_type": schedule.report_type,
        "generated_at": _utcnow().isoformat(),
        "total_rows": len(rows),
        "filters": {
            "job_id": schedule.job_id,
            "date_from": schedule.date_from.isoformat() if schedule.date_from else None,
            "date_to": schedule.date_to.isoformat() if schedule.date_to else None,
        },
    }
    return metadata, columns, rows


def _render_attachment(
    schedule: ReportSchedule,
    metadata: dict[str, Any],
    columns: list[str],
    rows: list[dict[str, Any]],
) -> tuple[bytes, str, str]:
    timestamp = _utcnow().strftime("%Y%m%d_%H%M%S")
    if schedule.format == "json":
        payload = json.dumps(
            {"metadata": metadata, "columns": columns, "rows": rows},
            ensure_ascii=False,
            indent=2,
            default=str,
        ).encode("utf-8")
        return payload, "application/json", f"{schedule.report_type}_report_{timestamp}.json"

    converter = FORMAT_CONVERTERS.get(schedule.format)
    if not converter:
        raise ValueError(f"Invalid report format: {schedule.format}")

    if schedule.format in {"csv", "xlsx"}:
        attachment = converter(columns, rows)
    else:
        attachment = converter(columns, rows, title=REPORT_TITLES.get(schedule.report_type, "Report"))

    content_types = {
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pdf": "application/pdf",
    }
    return attachment, content_types[schedule.format], f"{schedule.report_type}_report_{timestamp}.{schedule.format}"


def _smtp_enabled() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def _send_report_email(
    to_email: str,
    schedule: ReportSchedule,
    metadata: dict[str, Any],
    attachment_bytes: bytes,
    attachment_mime: str,
    attachment_filename: str,
) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

    if not host or not from_email:
        raise RuntimeError("SMTP is not configured. Missing SMTP_HOST or SMTP_FROM.")

    msg = EmailMessage()
    msg["Subject"] = f"[MEGS] Scheduled report ready: {schedule.name}"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(
        "\n".join(
            [
                f'Scheduled report "{schedule.name}" has been generated.',
                f"Report type: {schedule.report_type}",
                f"Rows: {metadata['total_rows']}",
                f"Format: {schedule.format}",
                "Open the Reports page in-app for the latest schedule history.",
            ]
        )
    )

    maintype, subtype = attachment_mime.split("/", 1)
    msg.add_attachment(attachment_bytes, maintype=maintype, subtype=subtype, filename=attachment_filename)

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(msg)


def deliver_report_schedule(
    session: Session,
    schedule_id: int,
    actor_user_id: Optional[int],
    actor_type: str,
) -> dict[str, Any]:
    if not is_automation_enabled("scheduled_reports"):
        return {"schedule_id": schedule_id, "skipped": True, "reason": "scheduled_reports disabled"}

    schedule = session.get(ReportSchedule, schedule_id)
    if not schedule:
        raise ValueError("Report schedule not found")
    if not schedule.is_active:
        return {"schedule_id": schedule_id, "skipped": True, "reason": "inactive"}

    metadata, columns, rows = _render_report(schedule, session)
    attachment_bytes, attachment_mime, attachment_filename = _render_attachment(schedule, metadata, columns, rows)

    in_app = schedule.delivery_channel in {"in_app", "both"}
    email = schedule.delivery_channel in {"email", "both"}
    email_result: dict[str, Any] = {"sent": False}
    in_app_sent = False

    recipient_email = schedule.recipient_email
    if email and not recipient_email and schedule.created_by_user_id:
        creator = session.get(User, schedule.created_by_user_id)
        recipient_email = creator.email if creator else None

    if in_app and schedule.created_by_user_id:
        create_notification(
            session=session,
            user_id=schedule.created_by_user_id,
            type=NotificationType.INFO,
            message=f'Scheduled report "{schedule.name}" is ready.',
            link="/reports",
        )
        in_app_sent = True

    if email:
        if recipient_email and _smtp_enabled():
            _send_report_email(
                recipient_email,
                schedule,
                metadata,
                attachment_bytes,
                attachment_mime,
                attachment_filename,
            )
            email_result = {"sent": True, "recipient": recipient_email}
        else:
            email_result = {
                "sent": False,
                "error": "Email delivery unavailable or recipient missing",
                "recipient": recipient_email,
            }

    now = _utcnow()
    before_state = {
        "last_run_at": schedule.last_run_at.isoformat() if schedule.last_run_at else None,
        "next_run_at": schedule.next_run_at.isoformat() if schedule.next_run_at else None,
        "delivery_channel": schedule.delivery_channel,
    }
    schedule.last_run_at = now
    schedule.next_run_at = _next_run_at(schedule.cadence, now)
    schedule.updated_at = now
    session.add(schedule)
    log_audit(
        session=session,
        user_id=actor_user_id,
        actor_type=actor_type,
        action="RUN_SCHEDULED_REPORT",
        entity_type="ReportSchedule",
        entity_id=schedule.id,
        details=f"Scheduled report {schedule.name} generated",
        before_state=json.dumps(before_state),
        after_state=json.dumps(
            {
                "last_run_at": schedule.last_run_at.isoformat() if schedule.last_run_at else None,
                "next_run_at": schedule.next_run_at.isoformat() if schedule.next_run_at else None,
                "in_app_sent": in_app_sent,
                "email_result": email_result,
                "rows": metadata["total_rows"],
            }
        ),
    )
    session.commit()
    session.refresh(schedule)

    return {
        "schedule_id": schedule.id,
        "name": schedule.name,
        "report_type": schedule.report_type,
        "rows": metadata["total_rows"],
        "in_app_sent": in_app_sent,
        "email_result": email_result,
        "next_run_at": schedule.next_run_at,
    }


def enqueue_due_report_schedules(session: Session, limit: int = 10) -> list[dict[str, Any]]:
    if not is_automation_enabled("scheduled_reports"):
        return []

    now = _utcnow()
    due_schedules = session.exec(
        select(ReportSchedule)
        .where(ReportSchedule.is_active == True)  # noqa: E712
        .where(ReportSchedule.next_run_at.is_not(None))
        .where(ReportSchedule.next_run_at <= now)
        .order_by(ReportSchedule.next_run_at.asc())
        .limit(limit)
    ).all()

    jobs = []
    for schedule in due_schedules:
        payload = {"schedule_id": schedule.id}
        idempotency_key = f"report_schedule:{schedule.id}:{schedule.next_run_at.isoformat() if schedule.next_run_at else 'manual'}"
        job = enqueue_automation_job(
            session,
            job_type="scheduled_report_delivery",
            payload=payload,
            actor_user_id=schedule.created_by_user_id,
            actor_type="system",
            idempotency_key=idempotency_key,
            execute_now=False,
        )
        jobs.append({
            "job_id": job.id,
            "schedule_id": schedule.id,
            "status": job.status,
        })

    return jobs
