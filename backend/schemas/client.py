from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ClientBase(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

class ClientResponse(ClientBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
