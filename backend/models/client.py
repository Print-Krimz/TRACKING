from datetime import datetime
from typing import TYPE_CHECKING, Optional, List
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.deployment import Deployment

class Client(SQLModel, table=True):
    """
    Client Model representing companies hiring manpower.
    """
    __tablename__ = "client"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    company_name: str = Field(index=True, description="Name of the client company")
    contact_person: Optional[str] = Field(default=None, description="Primary contact name")
    email: Optional[str] = Field(default=None, description="Contact email")
    phone: Optional[str] = Field(default=None, description="Contact phone snippet")
    location: Optional[str] = Field(default=None, description="Company address")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    deployments: List["Deployment"] = Relationship(back_populates="client")
