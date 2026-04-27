from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from database import get_session
from dependencies import get_current_user
from models.application_message import ApplicationMessage
from models.user import User
from schemas.messaging import UnreadCountResponse

router = APIRouter(
    prefix="/messages",
    tags=["Messaging"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_message_count(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(func.count())
        .select_from(ApplicationMessage)
        .where(
            ApplicationMessage.recipient_user_id == current_user.id,
            ApplicationMessage.is_read == False,
        )
    )
    unread_count = int(session.exec(query).one())
    return {"unread_count": unread_count}
