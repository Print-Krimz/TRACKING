"""
Talent Pool Routes

Recruiter workflows for saving and rematching candidates who were not selected
for their original application.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from database import get_session
from dependencies import check_permissions
from models.application import Application
from models.talent_pool import TalentPoolEntry, TalentPoolStatus
from models.user import User
from schemas.talent_pool import (
    TalentPoolBulkRescanResponse,
    TalentPoolListResponse,
    TalentPoolRescanResponse,
    TalentPoolSaveRequest,
    TalentPoolSaveResponse,
)
from services.talent_pool_service import (
    bulk_rescan_talent_pool,
    list_talent_pool_entries,
    rescan_talent_pool_entry,
    save_application_to_talent_pool,
)


router = APIRouter(
    prefix="/talent-pool",
    tags=["Talent Pool"],
    responses={401: {"description": "Not authenticated"}},
)


@router.post(
    "/entries",
    response_model=TalentPoolSaveResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save candidate to talent pool",
    description="Save an application as a talent pool candidate. Requires 'manage_applications' permission.",
)
def save_candidate_to_talent_pool(
    request: TalentPoolSaveRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    application = session.get(Application, request.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    try:
        entry, created = save_application_to_talent_pool(
            session,
            application,
            recruiter_id=current_user.id,
            notes=request.notes,
            auto_rescan=request.auto_rescan,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TalentPoolSaveResponse(created=created, entry=entry)


@router.get(
    "/entries",
    response_model=TalentPoolListResponse,
    summary="List talent pool entries",
    description="Browse the dedicated talent pool with search and filters. Requires 'view_all_applications' permission.",
)
def get_talent_pool_entries(
    search: str = Query(default=""),
    pool_status: TalentPoolStatus | None = Query(default=None),
    min_match_score: int | None = Query(default=None, ge=0, le=100),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_all_applications")),
):
    entries, total, total_pages = list_talent_pool_entries(
        session,
        search=search,
        pool_status=pool_status,
        min_match_score=min_match_score,
        page=page,
        limit=limit,
    )

    return TalentPoolListResponse(
        entries=entries,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.post(
    "/entries/{entry_id}/rescan",
    response_model=TalentPoolRescanResponse,
    summary="Rescan one talent pool entry",
    description="Re-evaluate a talent pool candidate against open jobs. Requires 'manage_applications' permission.",
)
def rescan_pool_entry(
    entry_id: int,
    target_job_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    entry = session.get(TalentPoolEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Talent pool entry not found")

    updated = rescan_talent_pool_entry(session, entry, target_job_id=target_job_id)
    return TalentPoolRescanResponse(entry=updated)


@router.post(
    "/rescan",
    response_model=TalentPoolBulkRescanResponse,
    summary="Bulk rescan the talent pool",
    description="Trigger a bulk rematch for active pool entries. Requires 'manage_applications' permission.",
)
def bulk_rescan_pool(
    target_job_id: int | None = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications")),
):
    updated_entries = bulk_rescan_talent_pool(
        session,
        target_job_id=target_job_id,
        recruiter_id=current_user.id,
    )
    matched_entries = len([entry for entry in updated_entries if entry.matched_open_jobs_count > 0])

    return TalentPoolBulkRescanResponse(
        rescanned_count=len(updated_entries),
        matched_entries=matched_entries,
        entries=updated_entries,
    )
