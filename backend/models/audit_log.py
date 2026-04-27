from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, Relationship, SQLModel, Column
from sqlalchemy import Text

if TYPE_CHECKING:
    from models.user import User

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, description="The user who performed the action")
    
    action: str = Field(description="Action performed (e.g., UPLOAD_DOCUMENT, DELETE_DOCUMENT)", max_length=100)
    entity_type: str = Field(description="The entity affected (e.g., Document)", max_length=50)
    entity_id: Optional[int] = Field(default=None, description="The ID of the affected entity")
    
    details: Optional[str] = Field(default=None, sa_column=Column(Text), description="JSON or text details of the action")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="audit_logs")
