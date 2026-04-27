import os
import smtplib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Dict, List, Optional

from sqlalchemy import and_, text
from sqlmodel import Session, select, func

from database import engine
from models.deployment import Deployment, DeploymentStatus
from models.deployment_contract_alert import (
    ContractAlertEmailStatus,
    ContractAlertStage,
    DeploymentContractAlert,
)
from models.permission import Permission, RolePermissionLink
from models.user import User

THRESHOLD_TO_STAGE = {
    30: ContractAlertStage.D30,
    14: ContractAlertStage.D14,
    7: ContractAlertStage.D7,
    1: ContractAlertStage.D1,
}

STAGE_TO_LABEL = {
    ContractAlertStage.D30: "30 days remaining",
    ContractAlertStage.D14: "14 days remaining",
    ContractAlertStage.D7: "7 days remaining",
    ContractAlertStage.D1: "1 day remaining",
    ContractAlertStage.EXPIRED: "Contract expired",
}

ALERT_LOCK_KEY = 90422157


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _alert_type(stage: ContractAlertStage) -> str:
    return "error" if stage == ContractAlertStage.EXPIRED else "warning"


def _has_existing_stage(
    session: Session, deployment_id: int, end_date: datetime, stage: ContractAlertStage
) -> bool:
    query = select(DeploymentContractAlert.id).where(
        DeploymentContractAlert.deployment_id == deployment_id,
        DeploymentContractAlert.contract_end_date == end_date,
        DeploymentContractAlert.stage_code == stage,
    )
    return session.exec(query).first() is not None


def _create_alert(
    session: Session,
    deployment: Deployment,
    stage: ContractAlertStage,
    days_remaining: int,
    now_utc: datetime,
) -> Optional[DeploymentContractAlert]:
    end_date = deployment.end_date
    if end_date is None:
        return None
    if _has_existing_stage(session, deployment.id, end_date, stage):
        return None
    alert = DeploymentContractAlert(
        deployment_id=deployment.id,
        contract_end_date=end_date,
        stage_code=stage,
        days_remaining=days_remaining,
        created_at=now_utc.replace(tzinfo=None),
    )
    session.add(alert)
    session.flush()
    return alert


def _append_auto_terminated_note(deployment: Deployment, now_utc: datetime) -> None:
    marker = f"[AUTO_TERMINATED_CONTRACT_EXPIRED {now_utc.date().isoformat()}]"
    current = (deployment.notes or "").strip()
    if marker in current:
        return
    deployment.notes = f"{current}\n{marker}".strip() if current else marker


def _smtp_enabled() -> bool:
    return bool(os.getenv("SMTP_HOST")) and bool(os.getenv("SMTP_FROM"))


def _get_email_recipients(session: Session) -> List[User]:
    query = (
        select(User)
        .join(RolePermissionLink, RolePermissionLink.role_id == User.role_id)
        .join(Permission, Permission.id == RolePermissionLink.permission_id)
        .where(
            Permission.name.in_(["manage_applications", "view_analytics"]),
            User.email.is_not(None),
            User.email != "",
        )
    )
    # Distinct by id while preserving model instances.
    recipients: Dict[int, User] = {}
    for user in session.exec(query).all():
        recipients[user.id] = user
    return list(recipients.values())


def _build_digest_body(alerts: List[DeploymentContractAlert], run_at: datetime) -> str:
    by_stage: Dict[ContractAlertStage, List[DeploymentContractAlert]] = defaultdict(list)
    for alert in alerts:
        by_stage[alert.stage_code].append(alert)

    lines = [
        "Deployment Contract Alerts Digest",
        f"Run time (UTC): {run_at.isoformat()}",
        "",
    ]

    for stage in [
        ContractAlertStage.EXPIRED,
        ContractAlertStage.D1,
        ContractAlertStage.D7,
        ContractAlertStage.D14,
        ContractAlertStage.D30,
    ]:
        stage_alerts = by_stage.get(stage, [])
        if not stage_alerts:
            continue
        lines.append(f"{STAGE_TO_LABEL[stage]}: {len(stage_alerts)}")
        for alert in stage_alerts[:50]:
            lines.append(
                f"- Deployment #{alert.deployment_id} "
                f"(days remaining: {alert.days_remaining})"
            )
        if len(stage_alerts) > 50:
            lines.append(f"- ... and {len(stage_alerts) - 50} more")
        lines.append("")

    lines.append("Open the Deployments page to review affected contracts.")
    return "\n".join(lines)


def _send_digest_email(
    to_email: str, alerts: List[DeploymentContractAlert], run_at: datetime
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
    msg["Subject"] = f"[MEGS] Deployment Contract Alerts ({run_at.date().isoformat()})"
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(_build_digest_body(alerts, run_at))

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(msg)


def _mark_email_status(
    session: Session,
    alerts: List[DeploymentContractAlert],
    status: ContractAlertEmailStatus,
    error: Optional[str] = None,
) -> None:
    for alert in alerts:
        alert.email_status = status
        alert.email_error = error
        session.add(alert)
    session.commit()


def _send_alert_digests(session: Session, new_alerts: List[DeploymentContractAlert], now_utc: datetime) -> None:
    if not new_alerts or not _smtp_enabled():
        return
    recipients = _get_email_recipients(session)
    if not recipients:
        return

    last_error: Optional[str] = None
    any_success = False

    for recipient in recipients:
        try:
            _send_digest_email(recipient.email, new_alerts, now_utc)
            any_success = True
        except Exception as exc:  # pragma: no cover - network/SMTP-dependent
            last_error = str(exc)

    if any_success and last_error is None:
        _mark_email_status(session, new_alerts, ContractAlertEmailStatus.SENT)
    elif any_success and last_error is not None:
        # Partial failure is still operationally useful to flag.
        _mark_email_status(
            session,
            new_alerts,
            ContractAlertEmailStatus.FAILED,
            f"Partial email delivery failure: {last_error}",
        )
    else:
        _mark_email_status(
            session,
            new_alerts,
            ContractAlertEmailStatus.FAILED,
            last_error or "SMTP delivery failed for all recipients.",
        )


def _acquire_pg_lock(session: Session) -> bool:
    if engine.url.get_backend_name() != "postgresql":
        return True
    locked = session.exec(text(f"SELECT pg_try_advisory_lock({ALERT_LOCK_KEY})")).first()
    return bool(locked)


def _release_pg_lock(session: Session) -> None:
    if engine.url.get_backend_name() != "postgresql":
        return
    session.exec(text(f"SELECT pg_advisory_unlock({ALERT_LOCK_KEY})"))
    session.commit()


def run_contract_expiration_alert_job(now_utc: Optional[datetime] = None) -> dict:
    now_utc = _normalize_utc(now_utc or _utc_now())
    created_alerts_count = 0
    auto_terminated_count = 0

    with Session(engine) as session:
        if not _acquire_pg_lock(session):
            return {
                "ran": False,
                "reason": "lock_not_acquired",
                "created_alerts": 0,
                "auto_terminated": 0,
            }

        try:
            deployments = session.exec(
                select(Deployment).where(
                    and_(
                        Deployment.status == DeploymentStatus.ACTIVE,
                        Deployment.end_date.is_not(None),
                    )
                )
            ).all()

            new_alerts: List[DeploymentContractAlert] = []

            for deployment in deployments:
                end_date = deployment.end_date
                if end_date is None:
                    continue
                end_utc = _normalize_utc(end_date)
                days_remaining = (end_utc.date() - now_utc.date()).days

                if days_remaining in THRESHOLD_TO_STAGE:
                    created = _create_alert(
                        session,
                        deployment,
                        THRESHOLD_TO_STAGE[days_remaining],
                        days_remaining,
                        now_utc,
                    )
                    if created:
                        new_alerts.append(created)
                        created_alerts_count += 1

                if days_remaining < 0:
                    deployment.status = DeploymentStatus.TERMINATED
                    _append_auto_terminated_note(deployment, now_utc)
                    session.add(deployment)
                    auto_terminated_count += 1

                    created = _create_alert(
                        session,
                        deployment,
                        ContractAlertStage.EXPIRED,
                        days_remaining,
                        now_utc,
                    )
                    if created:
                        new_alerts.append(created)
                        created_alerts_count += 1

            session.commit()
            for alert in new_alerts:
                session.refresh(alert)

            _send_alert_digests(session, new_alerts, now_utc)

            return {
                "ran": True,
                "created_alerts": created_alerts_count,
                "auto_terminated": auto_terminated_count,
            }
        finally:
            _release_pg_lock(session)


def list_contract_alerts(
    session: Session,
    stage: Optional[ContractAlertStage] = None,
    since: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[DeploymentContractAlert]:
    query = select(DeploymentContractAlert)

    if stage:
        query = query.where(DeploymentContractAlert.stage_code == stage)
    if since:
        query = query.where(DeploymentContractAlert.created_at >= since)
    else:
        query = query.where(
            DeploymentContractAlert.created_at >= (
                datetime.utcnow() - timedelta(days=14)
            )
        )

    query = query.order_by(DeploymentContractAlert.created_at.desc())
    query = query.offset(offset).limit(limit)
    return session.exec(query).all()


def count_contract_alerts(
    session: Session,
    stage: Optional[ContractAlertStage] = None,
    since: Optional[datetime] = None,
) -> int:
    query = select(func.count()).select_from(DeploymentContractAlert)
    if stage:
        query = query.where(DeploymentContractAlert.stage_code == stage)
    if since:
        query = query.where(DeploymentContractAlert.created_at >= since)
    else:
        query = query.where(
            DeploymentContractAlert.created_at >= (
                datetime.utcnow() - timedelta(days=14)
            )
        )
    return int(session.exec(query).one())


def serialize_contract_alert(alert: DeploymentContractAlert) -> dict:
    stage = alert.stage_code
    return {
        "id": alert.id,
        "deployment_id": alert.deployment_id,
        "stage_code": stage,
        "days_remaining": alert.days_remaining,
        "created_at": alert.created_at,
        "type": _alert_type(stage),
        "message": (
            "Deployment contract expired and was auto-terminated."
            if stage == ContractAlertStage.EXPIRED
            else f"Deployment contract expires in {alert.days_remaining} day(s)."
        ),
        "link": "/deployments",
    }
