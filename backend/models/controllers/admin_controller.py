"""
Admin Controller

Business logic for admin-only operations:
- Audit log retrieval with filtering
- System-wide statistics aggregation
"""

from typing import Optional, List
from sqlmodel import Session, select, func, col
from sqlalchemy import desc

from models.audit_log import AuditLog
from models.user import User
from models.resume import Resume
from models.document import Document
from models.application import Application
from models.job import JobRequisition, JobStatus
from models.client import Client
from models.deployment import Deployment, DeploymentStatus
from schemas.admin import AuditLogResponse, AuditLogListResponse, SystemStatsResponse


def get_audit_logs(
    session: Session,
    limit: int = 50,
    offset: int = 0,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
) -> AuditLogListResponse:
    """
    Retrieve audit logs with optional filtering.
    Returns newest first.
    """
    query = select(AuditLog).order_by(desc(AuditLog.timestamp))

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.where(AuditLog.entity_type.ilike(f"%{entity_type}%"))

    # Get total count (before pagination)
    count_query = select(func.count()).select_from(AuditLog)
    if user_id:
        count_query = count_query.where(AuditLog.user_id == user_id)
    if action:
        count_query = count_query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        count_query = count_query.where(AuditLog.entity_type.ilike(f"%{entity_type}%"))
    total = session.exec(count_query).one()

    # Apply pagination
    query = query.offset(offset).limit(limit)
    logs = session.exec(query).all()

    # Build response with username lookup
    result = []
    for log in logs:
        user = session.get(User, log.user_id)
        result.append(AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            username=user.username if user else f"User #{log.user_id}",
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            timestamp=log.timestamp,
        ))

    return AuditLogListResponse(logs=result, total=total)


def get_system_stats(session: Session) -> SystemStatsResponse:
    """
    Aggregate system-wide statistics for the admin dashboard.
    """
    # User counts by role
    total_users = session.exec(select(func.count()).select_from(User)).one()

    # Count by role name
    from models.role import Role
    applicant_role = session.exec(select(Role).where(Role.name == "Applicant")).first()
    recruiter_role = session.exec(select(Role).where(Role.name == "Recruiter")).first()
    admin_role = session.exec(select(Role).where(Role.name == "Admin")).first()

    total_applicants = 0
    total_recruiters = 0
    total_admins = 0

    if applicant_role:
        total_applicants = session.exec(
            select(func.count()).select_from(User).where(User.role_id == applicant_role.id)
        ).one()
    if recruiter_role:
        total_recruiters = session.exec(
            select(func.count()).select_from(User).where(User.role_id == recruiter_role.id)
        ).one()
    if admin_role:
        total_admins = session.exec(
            select(func.count()).select_from(User).where(User.role_id == admin_role.id)
        ).one()

    # Jobs
    total_jobs = session.exec(select(func.count()).select_from(JobRequisition)).one()
    open_jobs = session.exec(
        select(func.count()).select_from(JobRequisition).where(JobRequisition.status == JobStatus.OPEN)
    ).one()

    # Applications
    total_applications = session.exec(select(func.count()).select_from(Application)).one()

    # Resumes
    total_resumes = session.exec(select(func.count()).select_from(Resume)).one()

    # Documents
    total_documents = session.exec(select(func.count()).select_from(Document)).one()

    # Storage (sum of file sizes)
    storage_result = session.exec(
        select(func.coalesce(func.sum(Document.file_size_bytes), 0))
    ).one()
    storage_bytes = int(storage_result)

    # Clients
    total_clients = session.exec(select(func.count()).select_from(Client)).one()

    # Deployments
    total_deployments = session.exec(select(func.count()).select_from(Deployment)).one()
    active_deployments = session.exec(
        select(func.count()).select_from(Deployment).where(Deployment.status == DeploymentStatus.ACTIVE)
    ).one()

    # Audit logs
    audit_log_count = session.exec(select(func.count()).select_from(AuditLog)).one()

    return SystemStatsResponse(
        total_users=total_users,
        total_applicants=total_applicants,
        total_recruiters=total_recruiters,
        total_admins=total_admins,
        total_jobs=total_jobs,
        open_jobs=open_jobs,
        total_applications=total_applications,
        total_resumes=total_resumes,
        total_documents=total_documents,
        total_clients=total_clients,
        total_deployments=total_deployments,
        active_deployments=active_deployments,
        storage_bytes=storage_bytes,
        audit_log_count=audit_log_count,
    )
