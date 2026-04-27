from datetime import datetime
from typing import TYPE_CHECKING, Optional
from enum import Enum
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.client import Client
    from models.application import Application
    from models.user import User
    from models.job import JobRequisition

class DeploymentStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    TERMINATED = "terminated"

class Deployment(SQLModel, table=True):
    """
    Deployment Model representing an active worker deployed to a client.
    """
    __tablename__ = "deployment"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Relationships
    application_id: int = Field(foreign_key="application.id", index=True)
    candidate_id: int = Field(foreign_key="user.id")
    job_id: int = Field(foreign_key="job_requisition.id")
    client_id: int = Field(foreign_key="client.id")
    
    start_date: datetime = Field(default_factory=datetime.utcnow)
    end_date: Optional[datetime] = Field(default=None)
    
    status: DeploymentStatus = Field(default=DeploymentStatus.ACTIVE)
    
    # Recruiter remarks
    notes: Optional[str] = Field(default=None)
    
    # ORM relationships
    client: Optional["Client"] = Relationship(back_populates="deployments")
    application: Optional["Application"] = Relationship()
    candidate: Optional["User"] = Relationship()
    job: Optional["JobRequisition"] = Relationship()
