from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class NotificationType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class AppNotification(SQLModel, table=True):
    __tablename__ = "app_notification"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: NotificationType = Field(default=NotificationType.INFO)
    message: str = Field(max_length=1000)
    link: Optional[str] = Field(default=None, max_length=255)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
