from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class MessageSendRequest(BaseModel):
    body: str = Field(min_length=1, max_length=3000)


class MarkMessagesReadRequest(BaseModel):
    message_ids: Optional[List[int]] = None


class MessageResponse(BaseModel):
    id: int
    thread_id: int
    sender_user_id: int
    sender_username: Optional[str] = None
    recipient_user_id: int
    body: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MessageThreadResponse(BaseModel):
    thread_id: int
    application_id: int
    messages: List[MessageResponse]
    total: int
    page: int
    limit: int


class UnreadCountResponse(BaseModel):
    unread_count: int
