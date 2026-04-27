from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models.deployment import DeploymentStatus
from schemas.client import ClientResponse

class DeploymentCreate(BaseModel):
    application_id: int
    client_id: int
    end_date: Optional[datetime] = None
    notes: Optional[str] = None

class DeploymentUpdate(BaseModel):
    status: Optional[DeploymentStatus] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None

class DeploymentResponse(BaseModel):
    id: int
    application_id: int
    candidate_id: int
    job_id: int
    client_id: int
    start_date: datetime
    end_date: Optional[datetime] = None
    status: DeploymentStatus
    notes: Optional[str] = None
    
    # Nested data for frontend convenience
    candidate_name: str
    job_title: str
    client: ClientResponse
    
    class Config:
        from_attributes = True

class DeploymentListResponse(BaseModel):
    deployments: List[DeploymentResponse]
    total: int
