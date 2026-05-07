import json
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

from sqlmodel import Session, select

from models.automation_job import AutomationJob, AutomationJobStatus


AutomationHandler = Callable[[Session, dict[str, Any], Optional[int], str], dict[str, Any]]

HANDLERS: dict[str, AutomationHandler] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_handlers_loaded() -> None:
    if HANDLERS:
        return
    try:
        import services.automation_handlers  # noqa: F401
    except Exception:
        pass


def register_automation_handler(job_type: str):
    def decorator(func: AutomationHandler):
        HANDLERS[job_type] = func
        return func

    return decorator


def _serialize(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def _deserialize(value: Optional[str]) -> Any:
    if not value:
        return None
    return json.loads(value)


def enqueue_automation_job(
    session: Session,
    job_type: str,
    payload: dict[str, Any],
    actor_user_id: Optional[int],
    actor_type: str = "user",
    idempotency_key: Optional[str] = None,
    max_attempts: int = 3,
    execute_now: bool = True,
) -> AutomationJob:
    _ensure_handlers_loaded()
    key = idempotency_key or f"{job_type}:{_serialize(payload)}"
    existing = session.exec(
        select(AutomationJob).where(
            AutomationJob.job_type == job_type,
            AutomationJob.idempotency_key == key,
        )
    ).first()
    if existing:
        if execute_now and existing.status in {AutomationJobStatus.QUEUED, AutomationJobStatus.FAILED}:
            _process_automation_job(session, existing)
        return existing

    job = AutomationJob(
        job_type=job_type,
        idempotency_key=key,
        actor_type=actor_type,
        actor_user_id=actor_user_id,
        payload_json=_serialize(payload),
        status=AutomationJobStatus.QUEUED,
        max_attempts=max_attempts,
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    if execute_now:
        _process_automation_job(session, job)
        session.refresh(job)
    return job


def _process_automation_job(session: Session, job: AutomationJob) -> AutomationJob:
    handler = HANDLERS.get(job.job_type)
    if not handler:
        job.status = AutomationJobStatus.FAILED
        job.error_message = f"No handler registered for {job.job_type}"
        job.updated_at = _utcnow()
        session.add(job)
        session.commit()
        session.refresh(job)
        return job

    payload = _deserialize(job.payload_json) or {}
    job.status = AutomationJobStatus.RUNNING
    job.started_at = job.started_at or _utcnow()
    job.attempts += 1
    job.updated_at = _utcnow()
    session.add(job)
    session.commit()

    started_at = _utcnow()
    try:
        result = handler(session, payload, job.actor_user_id, job.actor_type)
        job.result_json = _serialize(result or {})
        job.status = AutomationJobStatus.SUCCEEDED
        job.error_message = None
        job.finished_at = _utcnow()
        job.latency_ms = int((job.finished_at - started_at).total_seconds() * 1000)
    except Exception as exc:
        job.error_message = str(exc)
        if job.attempts < job.max_attempts:
            job.status = AutomationJobStatus.QUEUED
            job.next_retry_at = _utcnow() + timedelta(seconds=min(30, 2 ** job.attempts))
        else:
            job.status = AutomationJobStatus.FAILED
            job.finished_at = _utcnow()
            job.latency_ms = int((job.finished_at - started_at).total_seconds() * 1000)
    finally:
        job.updated_at = _utcnow()
        session.add(job)
        session.commit()
        session.refresh(job)

    return job


def process_pending_automation_jobs(session: Session, limit: int = 10) -> list[AutomationJob]:
    _ensure_handlers_loaded()
    now = _utcnow()
    jobs = session.exec(
        select(AutomationJob)
        .where(AutomationJob.status == AutomationJobStatus.QUEUED)
        .where((AutomationJob.next_retry_at == None) | (AutomationJob.next_retry_at <= now))  # noqa: E711
        .order_by(AutomationJob.created_at.asc())
        .limit(limit)
    ).all()
    return [_process_automation_job(session, job) for job in jobs]


def automation_metrics(session: Session) -> dict[str, Any]:
    jobs = session.exec(select(AutomationJob)).all()
    total = len(jobs)
    succeeded = len([job for job in jobs if job.status == AutomationJobStatus.SUCCEEDED])
    failed = len([job for job in jobs if job.status == AutomationJobStatus.FAILED])
    retries = sum(max(job.attempts - 1, 0) for job in jobs)
    latencies = [job.latency_ms for job in jobs if job.latency_ms is not None]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0
    return {
        "total_jobs": total,
        "success_rate": round((succeeded / total) * 100, 1) if total else 0,
        "failed_jobs": failed,
        "retries": retries,
        "avg_latency_ms": avg_latency,
    }
