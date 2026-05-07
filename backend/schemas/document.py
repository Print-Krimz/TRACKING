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
    document_type_candidate: Optional[str] = None
    expiration_date_candidate: Optional[datetime] = None
    extraction_confidence: Optional[float] = None
    metadata_confirmed: bool = False
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class DocumentMetadataUpdateRequest(BaseModel):
    document_type: Optional[str] = None
    expiration_date: Optional[datetime] = None
