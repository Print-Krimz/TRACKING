from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ApplicationMessageThread(SQLModel, table=True):
    __tablename__ = "application_message_thread"

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(
        foreign_key="application.id", index=True, unique=True
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ApplicationMessage(SQLModel, table=True):
    __tablename__ = "application_message"

    id: Optional[int] = Field(default=None, primary_key=True)
    thread_id: int = Field(foreign_key="application_message_thread.id", index=True)
    sender_user_id: int = Field(foreign_key="user.id", index=True)
    recipient_user_id: int = Field(foreign_key="user.id", index=True)
    body: str = Field(max_length=3000)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
