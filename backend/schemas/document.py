from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class DocumentResponse(BaseModel):
    id: int
    user_id: int
    document_type: str
    original_filename: str
    file_size_bytes: int
    expiration_date: Optional[datetime] = None
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int
