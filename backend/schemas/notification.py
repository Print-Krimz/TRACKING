from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: int
    type: NotificationType
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
