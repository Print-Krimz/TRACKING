from typing import Optional

from sqlmodel import Session

from models.audit_log import AuditLog


def log_audit(
    session: Session,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
    actor_type: str = "user",
    before_state: Optional[str] = None,
    after_state: Optional[str] = None,
) -> None:
    session.add(
        AuditLog(
            user_id=user_id,
            actor_type=actor_type,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            before_state=before_state,
            after_state=after_state,
        )
    )
