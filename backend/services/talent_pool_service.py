"""
Talent Pool Service

Business logic for saving silver-medalist candidates and re-evaluating them
against open roles.
"""

import json
from datetime import datetime
from typing import Iterable, List, Optional, Tuple

from sqlmodel import Session, select

from models.application import Application, ApplicationStatus
from models.job import JobRequisition, JobStatus
from models.resume import Resume
from models.talent_pool import TalentPoolEntry, TalentPoolStatus
from models.user import User
from schemas.talent_pool import TalentPoolEntryResponse
from services.matching_service import calculate_match_score


TALENT_POOL_MATCH_THRESHOLD = 60


def _latest_resume_for_candidate(session: Session, candidate_id: int) -> Optional[Resume]:
    return session.exec(
        select(Resume)
        .where(Resume.user_id == candidate_id)
        .order_by(Resume.created_at.desc())
    ).first()


def _get_entry_job_matches(
    session: Session,
    entry: TalentPoolEntry,
    target_job_id: Optional[int] = None,
) -> List[dict]:
    statement = select(JobRequisition).where(JobRequisition.status == JobStatus.OPEN)
    if target_job_id is not None:
        statement = statement.where(JobRequisition.id == target_job_id)

    jobs = session.exec(statement).all()
    ranked_matches = []

    for job in jobs:
        if target_job_id is None and entry.source_job_id == job.id:
            continue

        try:
            score, breakdown = calculate_match_score(session, job.id, entry.resume_id)
        except Exception:
            continue

        ranked_matches.append(
            {
                "job_id": job.id,
                "job_title": job.title,
                "match_score": score,
                "recommendation": breakdown.get("recommendation"),
                "keywords_matched": breakdown.get("keywords_matched", []),
            }
        )

    ranked_matches.sort(key=lambda item: item["match_score"], reverse=True)
    return ranked_matches


def _build_entry_response(session: Session, entry: TalentPoolEntry) -> TalentPoolEntryResponse:
    candidate = session.get(User, entry.candidate_id)
    source_job = session.get(JobRequisition, entry.source_job_id) if entry.source_job_id else None
    best_match_job = session.get(JobRequisition, entry.best_match_job_id) if entry.best_match_job_id else None

    return TalentPoolEntryResponse(
        id=entry.id,
        source_application_id=entry.source_application_id,
        candidate_id=entry.candidate_id,
        candidate_name=candidate.username if candidate else f"Candidate #{entry.candidate_id}",
        resume_id=entry.resume_id,
        source_job_id=entry.source_job_id,
        source_job_title=source_job.title if source_job else None,
        source_status=entry.source_status,
        pool_status=entry.pool_status,
        notes=entry.notes,
        best_match_job_id=entry.best_match_job_id,
        best_match_job_title=best_match_job.title if best_match_job else None,
        best_match_score=entry.best_match_score,
        matched_open_jobs_count=entry.matched_open_jobs_count,
        pooled_at=entry.pooled_at,
        updated_at=entry.updated_at,
        last_rescanned_at=entry.last_rescanned_at,
    )


def sync_rejected_applications_into_pool(
    session: Session,
    recruiter_id: Optional[int] = None,
) -> List[TalentPoolEntry]:
    """
    Backfill rejected applications into the talent pool.

    This keeps the talent pool useful for legacy rejected applicants that were
    never explicitly saved after the feature was introduced.
    """

    existing_application_ids = set(
        session.exec(select(TalentPoolEntry.source_application_id)).all()
    )

    rejected_applications = session.exec(
        select(Application)
        .where(Application.status == ApplicationStatus.REJECTED)
        .order_by(Application.updated_at.desc())
    ).all()

    created_entries: List[TalentPoolEntry] = []

    for application in rejected_applications:
        if application.id in existing_application_ids:
            continue

        resume_id = application.resume_id
        if resume_id is None:
            resume = _latest_resume_for_candidate(session, application.candidate_id)
            if not resume:
                continue
            resume_id = resume.id

        entry = TalentPoolEntry(
            candidate_id=application.candidate_id,
            resume_id=resume_id,
            source_application_id=application.id,
            source_job_id=application.job_id,
            added_by=recruiter_id,
            source_status=application.status,
            notes="Auto-added from rejected application",
        )
        session.add(entry)
        created_entries.append(entry)
        existing_application_ids.add(application.id)

    if created_entries:
        session.commit()
        for entry in created_entries:
            session.refresh(entry)

    return created_entries


def list_talent_pool_entries(
    session: Session,
    search: str = "",
    pool_status: Optional[TalentPoolStatus] = None,
    min_match_score: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
) -> Tuple[List[TalentPoolEntryResponse], int, int]:
    sync_rejected_applications_into_pool(session)

    entries = session.exec(
        select(TalentPoolEntry).order_by(TalentPoolEntry.pooled_at.desc())
    ).all()

    filtered = []
    search_term = search.strip().lower()

    for entry in entries:
        if pool_status and entry.pool_status != pool_status:
            continue
        if min_match_score is not None and (entry.best_match_score or 0) < min_match_score:
            continue

        candidate = session.get(User, entry.candidate_id)
        source_job = session.get(JobRequisition, entry.source_job_id) if entry.source_job_id else None
        best_match_job = session.get(JobRequisition, entry.best_match_job_id) if entry.best_match_job_id else None

        if search_term:
            haystack = " ".join(
                filter(
                    None,
                    [
                        candidate.username if candidate else None,
                        source_job.title if source_job else None,
                        best_match_job.title if best_match_job else None,
                        entry.notes,
                    ],
                )
            ).lower()
            if search_term not in haystack:
                continue

        filtered.append(
            TalentPoolEntryResponse(
                id=entry.id,
                source_application_id=entry.source_application_id,
                candidate_id=entry.candidate_id,
                candidate_name=candidate.username if candidate else f"Candidate #{entry.candidate_id}",
                resume_id=entry.resume_id,
                source_job_id=entry.source_job_id,
                source_job_title=source_job.title if source_job else None,
                source_status=entry.source_status,
                pool_status=entry.pool_status,
                notes=entry.notes,
                best_match_job_id=entry.best_match_job_id,
                best_match_job_title=best_match_job.title if best_match_job else None,
                best_match_score=entry.best_match_score,
                matched_open_jobs_count=entry.matched_open_jobs_count,
                pooled_at=entry.pooled_at,
                updated_at=entry.updated_at,
                last_rescanned_at=entry.last_rescanned_at,
            )
        )

    total = len(filtered)
    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    start = (page - 1) * limit
    end = start + limit
    return filtered[start:end], total, total_pages


def rescan_talent_pool_entry(
    session: Session,
    entry: TalentPoolEntry,
    target_job_id: Optional[int] = None,
) -> TalentPoolEntryResponse:
    ranked_matches = _get_entry_job_matches(session, entry, target_job_id=target_job_id)

    entry.last_rescanned_at = datetime.utcnow()
    entry.updated_at = entry.last_rescanned_at
    entry.match_snapshot = json.dumps(ranked_matches[:5]) if ranked_matches else None
    entry.matched_open_jobs_count = len(
        [match for match in ranked_matches if match["match_score"] >= TALENT_POOL_MATCH_THRESHOLD]
    )

    if ranked_matches:
        best_match = ranked_matches[0]
        entry.best_match_job_id = best_match["job_id"]
        entry.best_match_score = best_match["match_score"]
    else:
        entry.best_match_job_id = None
        entry.best_match_score = None

    session.add(entry)
    session.commit()
    session.refresh(entry)

    return _build_entry_response(session, entry)


def save_application_to_talent_pool(
    session: Session,
    application: Application,
    recruiter_id: int,
    notes: Optional[str] = None,
    auto_rescan: bool = True,
) -> Tuple[TalentPoolEntryResponse, bool]:
    existing = session.exec(
        select(TalentPoolEntry).where(
            TalentPoolEntry.source_application_id == application.id
        )
    ).first()

    resume_id = application.resume_id
    if resume_id is None:
        resume = _latest_resume_for_candidate(session, application.candidate_id)
        if not resume:
            raise ValueError("Candidate has no resume available for talent pool matching")
        resume_id = resume.id

    if existing:
        existing.resume_id = resume_id
        existing.source_status = application.status
        existing.pool_status = TalentPoolStatus.ACTIVE
        existing.notes = notes if notes is not None else existing.notes
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        entry = existing
        created = False
    else:
        entry = TalentPoolEntry(
            candidate_id=application.candidate_id,
            resume_id=resume_id,
            source_application_id=application.id,
            source_job_id=application.job_id,
            added_by=recruiter_id,
            source_status=application.status,
            notes=notes,
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        created = True

    response = (
        rescan_talent_pool_entry(session, entry)
        if auto_rescan
        else _build_entry_response(session, entry)
    )
    return response, created


def bulk_rescan_talent_pool(
    session: Session,
    target_job_id: Optional[int] = None,
    entry_ids: Optional[Iterable[int]] = None,
    recruiter_id: Optional[int] = None,
) -> List[TalentPoolEntryResponse]:
    sync_rejected_applications_into_pool(session, recruiter_id=recruiter_id)

    entries = session.exec(
        select(TalentPoolEntry).where(
            TalentPoolEntry.pool_status == TalentPoolStatus.ACTIVE
        )
    ).all()

    if entry_ids is not None:
        allowed_ids = set(entry_ids)
        entries = [entry for entry in entries if entry.id in allowed_ids]

    updated_entries = []
    for entry in entries:
        updated_entries.append(
            rescan_talent_pool_entry(session, entry, target_job_id=target_job_id)
        )
    return updated_entries
