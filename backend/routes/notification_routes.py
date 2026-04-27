from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func

from database import get_session
from dependencies import get_current_user
from models.notification import AppNotification
from models.user import User
from schemas.notification import NotificationListResponse

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    base = select(AppNotification).where(AppNotification.user_id == current_user.id)
    notifications = session.exec(
        base.order_by(AppNotification.created_at.desc()).offset(offset).limit(limit)
    ).all()
    total = int(
        session.exec(
            select(func.count())
            .select_from(AppNotification)
            .where(AppNotification.user_id == current_user.id)
        ).one()
    )
    unread_count = int(
        session.exec(
            select(func.count())
            .select_from(AppNotification)
            .where(
                AppNotification.user_id == current_user.id,
                AppNotification.is_read == False,
            )
        ).one()
    )
    return {
        "notifications": notifications,
        "total": total,
        "unread_count": unread_count,
    }


@router.patch("/read-all")
def mark_all_notifications_read(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    rows = session.exec(
        select(AppNotification).where(
            AppNotification.user_id == current_user.id,
            AppNotification.is_read == False,
        )
    ).all()
    for row in rows:
        row.is_read = True
        session.add(row)
    session.commit()
    return {"message": "Notifications marked as read"}


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    row = session.get(AppNotification, notification_id)
    if not row or row.user_id != current_user.id:
        return {"message": "Notification not found"}
    row.is_read = True
    session.add(row)
    session.commit()
    return {"message": "Notification marked as read"}
