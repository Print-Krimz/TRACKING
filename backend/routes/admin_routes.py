"""
Admin Routes

API endpoints for admin-only operations:
- GET /admin/audit-logs — Retrieve system audit trail
- GET /admin/system-stats — Aggregate system statistics
"""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from typing import Optional

from database import get_session
from dependencies import check_permissions
from models.user import User
from schemas.admin import AuditLogListResponse, SystemStatsResponse
from models.controllers.admin_controller import get_audit_logs, get_system_stats

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    responses={401: {"description": "Not authenticated"}, 403: {"description": "Forbidden"}},
)


@router.get("/audit-logs", response_model=AuditLogListResponse)
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: Optional[int] = Query(default=None),
    action: Optional[str] = Query(default=None),
    entity_type: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users")),
):
    """Retrieve audit logs with optional filtering. Admin only."""
    return get_audit_logs(session, limit, offset, user_id, action, entity_type)


@router.get("/system-stats", response_model=SystemStatsResponse)
def system_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users")),
):
    """Get system-wide statistics. Admin only."""
    return get_system_stats(session)
