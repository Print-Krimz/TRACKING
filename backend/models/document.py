from datetime import datetime
from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.user import User

class Document(SQLModel, table=True):
    __tablename__ = "document"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    
    document_type: str = Field(description="Type of document (e.g., Resume, ID, Contract, Certification)")
    file_path: str = Field(description="Local path to the uploaded file")
    original_filename: str = Field(max_length=255)
    file_size_bytes: int = Field(description="Size of the file in bytes")
    
    expiration_date: Optional[datetime] = Field(default=None, description="When this document expires")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional["User"] = Relationship(back_populates="documents")
