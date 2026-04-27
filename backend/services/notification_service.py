from typing import Optional

from sqlmodel import Session, select, func

from models.notification import AppNotification, NotificationType


def create_notification(
    session: Session,
    user_id: int,
    message: str,
    type: NotificationType = NotificationType.INFO,
    link: Optional[str] = None,
) -> AppNotification:
    notif = AppNotification(
        user_id=user_id,
        type=type,
        message=message,
        link=link,
    )
    session.add(notif)
    return notif


def get_unread_count(session: Session, user_id: int) -> int:
    query = (
        select(func.count())
        .select_from(AppNotification)
        .where(AppNotification.user_id == user_id, AppNotification.is_read == False)
    )
    return int(session.exec(query).one())
