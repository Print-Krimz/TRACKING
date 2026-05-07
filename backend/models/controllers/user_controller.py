"""
User Controller

Business logic for user management and lifecycle operations.
"""

from datetime import datetime
from typing import Dict, List, Optional

from sqlmodel import Session, func, select

from dependencies import hash_password, verify_password
from models.application import Application
from models.application_interview import ApplicationInterview
from models.application_message import ApplicationMessage
from models.audit_log import AuditLog
from models.deployment import Deployment
from models.document import Document
from models.job import JobRequisition
from models.notification import AppNotification
from models.resume import Resume
from models.role import Role
from models.talent_pool import TalentPoolEntry
from models.user import User
from schemas.user import (
    ArchiveUserRequest,
    AssignRoleRequest,
    PasswordChangeRequest,
    RestoreUserRequest,
    UserListResponse,
    UserUpdateRequest,
    UserWithRole,
)
from services.audit_service import log_audit


ADMIN_ROLE_NAMES = {"Admin", "Control Panel Admin"}


def _module_access_for_user(user: User) -> Dict[str, bool]:
    if (user.status or "active") != "active":
        return {
            "dashboard": False,
            "jobs": False,
            "applicants": False,
            "resumes": False,
            "reports": False,
            "talent_pool": False,
            "deployments": False,
            "admin_control_panel": False,
        }

    permission_names = {
        permission.name for permission in (user.role.permissions if user.role else [])
    }
    jobs_access = "view_jobs" in permission_names or "manage_jobs" in permission_names
    applicants_access = (
        "view_all_applications" in permission_names
        or "manage_applications" in permission_names
    )
    resumes_access = (
        "view_all_resumes" in permission_names
        or "view_own_resume" in permission_names
        or "analyze_resume" in permission_names
    )

    return {
        "dashboard": True,
        "jobs": jobs_access,
        "applicants": applicants_access,
        "resumes": resumes_access,
        "reports": "view_analytics" in permission_names,
        "talent_pool": applicants_access,
        "deployments": "manage_applications" in permission_names,
        "admin_control_panel": (
            "manage_users" in permission_names and "manage_roles" in permission_names
        ),
    }


def _to_user_with_role(user: User) -> UserWithRole:
    return UserWithRole(
        id=user.id,
        username=user.username,
        email=user.email,
        phone=user.phone,
        location=user.location,
        current_title=user.current_title,
        years_experience=user.years_experience,
        linkedin_url=user.linkedin_url,
        portfolio_url=user.portfolio_url,
        professional_summary=user.professional_summary,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        status=user.status or "active",
        archived_at=user.archived_at,
        archived_by_user_id=user.archived_by_user_id,
        archive_reason=user.archive_reason,
        effective_modules=_module_access_for_user(user),
    )


def _assert_not_self_action(target_user_id: int, actor_user_id: int) -> None:
    if target_user_id == actor_user_id:
        raise ValueError("You cannot perform this action on your own account.")


def _assert_not_last_active_admin(session: Session, target_user: User) -> None:
    target_role_name = target_user.role.name if target_user.role else ""
    if target_role_name not in ADMIN_ROLE_NAMES:
        return

    users = session.exec(select(User)).all()
    active_admin_count = sum(
        1
        for user in users
        if (user.status or "active") == "active"
        and user.role is not None
        and user.role.name in ADMIN_ROLE_NAMES
    )
    if active_admin_count <= 1 and (target_user.status or "active") == "active":
        raise PermissionError("Cannot archive/delete the last active admin account.")


def _user_dependency_counts(session: Session, user_id: int) -> Dict[str, int]:
    counts: Dict[str, int] = {}

    counts["resumes"] = session.exec(
        select(func.count()).select_from(Resume).where(Resume.user_id == user_id)
    ).one()
    counts["documents"] = session.exec(
        select(func.count()).select_from(Document).where(Document.user_id == user_id)
    ).one()
    counts["applications"] = session.exec(
        select(func.count())
        .select_from(Application)
        .where(Application.candidate_id == user_id)
    ).one()
    counts["notifications"] = session.exec(
        select(func.count())
        .select_from(AppNotification)
        .where(AppNotification.user_id == user_id)
    ).one()
    counts["deployments"] = session.exec(
        select(func.count())
        .select_from(Deployment)
        .where(Deployment.candidate_id == user_id)
    ).one()
    counts["jobs_created"] = session.exec(
        select(func.count())
        .select_from(JobRequisition)
        .where(JobRequisition.created_by == user_id)
    ).one()
    counts["audit_logs"] = session.exec(
        select(func.count()).select_from(AuditLog).where(AuditLog.user_id == user_id)
    ).one()
    counts["messages_sent"] = session.exec(
        select(func.count())
        .select_from(ApplicationMessage)
        .where(ApplicationMessage.sender_user_id == user_id)
    ).one()
    counts["messages_received"] = session.exec(
        select(func.count())
        .select_from(ApplicationMessage)
        .where(ApplicationMessage.recipient_user_id == user_id)
    ).one()
    counts["interviews_scheduled"] = session.exec(
        select(func.count())
        .select_from(ApplicationInterview)
        .where(ApplicationInterview.scheduled_by_user_id == user_id)
    ).one()
    counts["interviews_conducted"] = session.exec(
        select(func.count())
        .select_from(ApplicationInterview)
        .where(ApplicationInterview.interviewer_user_id == user_id)
    ).one()
    counts["talent_pool_candidate"] = session.exec(
        select(func.count())
        .select_from(TalentPoolEntry)
        .where(TalentPoolEntry.candidate_id == user_id)
    ).one()
    counts["talent_pool_added_by"] = session.exec(
        select(func.count())
        .select_from(TalentPoolEntry)
        .where(TalentPoolEntry.added_by == user_id)
    ).one()
    counts["archived_users"] = session.exec(
        select(func.count())
        .select_from(User)
        .where(User.archived_by_user_id == user_id)
    ).one()

    return {key: int(value or 0) for key, value in counts.items()}


def get_all_users(
    session: Session,
    status: Optional[str] = None,
    include_archived: bool = True,
) -> UserListResponse:
    statement = select(User)
    if status in {"active", "archived"}:
        statement = statement.where(User.status == status)
    elif not include_archived:
        statement = statement.where(
            (User.status == "active") | (User.status.is_(None))
        )

    users = session.exec(statement).all()
    user_list = [_to_user_with_role(user) for user in users]
    return UserListResponse(users=user_list, total=len(user_list))


def get_user_by_id(session: Session, user_id: int) -> Optional[UserWithRole]:
    user = session.get(User, user_id)
    if not user:
        return None
    return _to_user_with_role(user)


def assign_role_to_user(
    session: Session,
    user_id: int,
    request: AssignRoleRequest,
) -> UserWithRole:
    user = session.get(User, user_id)
    if not user:
        raise ValueError(f"User with ID {user_id} not found")

    role = session.exec(select(Role).where(Role.name == request.role_name)).first()
    if not role:
        raise ValueError(f"Role '{request.role_name}' not found")

    user.role_id = role.id
    session.add(user)
    session.commit()
    session.refresh(user)
    return _to_user_with_role(user)


def archive_user(
    session: Session,
    target_user_id: int,
    actor_user: User,
    request: ArchiveUserRequest,
) -> UserWithRole:
    _assert_not_self_action(target_user_id, actor_user.id)

    target_user = session.get(User, target_user_id)
    if not target_user:
        raise ValueError(f"User with ID {target_user_id} not found")

    if (target_user.status or "active") == "archived":
        return _to_user_with_role(target_user)

    _assert_not_last_active_admin(session, target_user)

    now = datetime.utcnow()
    target_user.status = "archived"
    target_user.archived_at = now
    target_user.archived_by_user_id = actor_user.id
    target_user.archive_reason = request.reason
    target_user.deleted_at = None

    session.add(target_user)
    log_audit(
        session=session,
        user_id=actor_user.id,
        action="ARCHIVE_USER",
        entity_type="User",
        entity_id=target_user.id,
        details=f"Archived user '{target_user.username}'. Reason: {request.reason}",
    )
    session.commit()
    session.refresh(target_user)
    return _to_user_with_role(target_user)


def restore_user(
    session: Session,
    target_user_id: int,
    actor_user: User,
    request: RestoreUserRequest,
) -> UserWithRole:
    _assert_not_self_action(target_user_id, actor_user.id)

    target_user = session.get(User, target_user_id)
    if not target_user:
        raise ValueError(f"User with ID {target_user_id} not found")

    target_user.status = "active"
    target_user.archived_at = None
    target_user.archived_by_user_id = None
    target_user.archive_reason = None
    target_user.deleted_at = None

    session.add(target_user)
    details = f"Restored user '{target_user.username}'"
    if request.reason:
        details = f"{details}. Reason: {request.reason}"
    log_audit(
        session=session,
        user_id=actor_user.id,
        action="RESTORE_USER",
        entity_type="User",
        entity_id=target_user.id,
        details=details,
    )
    session.commit()
    session.refresh(target_user)
    return _to_user_with_role(target_user)


def delete_user(
    session: Session,
    target_user_id: int,
    actor_user: User,
) -> None:
    _assert_not_self_action(target_user_id, actor_user.id)

    target_user = session.get(User, target_user_id)
    if not target_user:
        raise ValueError(f"User with ID {target_user_id} not found")

    _assert_not_last_active_admin(session, target_user)

    dependency_counts = _user_dependency_counts(session, target_user_id)
    blocking_dependencies = {
        name: count for name, count in dependency_counts.items() if count > 0
    }
    if blocking_dependencies:
        target_user.deleted_at = datetime.utcnow()
        session.add(target_user)
        details = f"Delete blocked by dependencies: {blocking_dependencies}"
        log_audit(
            session=session,
            user_id=actor_user.id,
            action="DELETE_USER_ATTEMPT",
            entity_type="User",
            entity_id=target_user.id,
            details=details,
        )
        session.commit()
        raise PermissionError(
            "Cannot delete user with dependent records. Archive the user instead."
        )

    username = target_user.username
    log_audit(
        session=session,
        user_id=actor_user.id,
        action="DELETE_USER",
        entity_type="User",
        entity_id=target_user.id,
        details=f"Permanently deleted user '{username}'",
    )
    session.delete(target_user)
    session.commit()


def get_all_roles(session: Session) -> List[Role]:
    return list(session.exec(select(Role)).all())


def update_user_profile(
    session: Session,
    user_id: int,
    request: UserUpdateRequest,
) -> UserWithRole:
    user = session.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    if request.username is not None:
        user.username = request.username
    if request.email is not None:
        user.email = request.email
    if request.phone is not None:
        user.phone = request.phone
    if request.location is not None:
        user.location = request.location
    if request.current_title is not None:
        user.current_title = request.current_title
    if request.years_experience is not None:
        user.years_experience = request.years_experience
    if request.linkedin_url is not None:
        user.linkedin_url = str(request.linkedin_url)
    if request.portfolio_url is not None:
        user.portfolio_url = str(request.portfolio_url)
    if request.professional_summary is not None:
        user.professional_summary = request.professional_summary

    session.add(user)
    log_audit(
        session=session,
        user_id=user.id,
        action="UPDATE_PROFILE",
        entity_type="User",
        entity_id=user.id,
        details="Updated profile fields",
    )
    session.commit()
    session.refresh(user)

    return _to_user_with_role(user)


def change_user_password(
    session: Session,
    user_id: int,
    request: PasswordChangeRequest,
):
    user = session.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    if not verify_password(request.current_password, user.hashed_password):
        raise ValueError("Incorrect current password")

    user.hashed_password = hash_password(request.new_password)
    session.add(user)
    session.commit()
