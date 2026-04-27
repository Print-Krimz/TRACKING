import os
import uuid
from datetime import datetime
from typing import List, Optional
from sqlmodel import Session, select
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import FileResponse

from models.document import Document
from models.audit_log import AuditLog
from models.user import User

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _log_audit(session: Session, user_id: int, action: str, entity_type: str, entity_id: int, details: str = None):
    audit = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )
    session.add(audit)
    # We do not commit here because the parent transaction should commit

def submit_document_file(
    session: Session,
    current_user: User,
    file: UploadFile,
    document_type: str,
    expiration_date: Optional[datetime] = None
) -> Document:
    # Validate file
    if not file.filename:
        raise ValueError("No filename provided")
        
    file_bytes = file.file.read()
    file_size = len(file_bytes)
    
    # Generate unique storage filename
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    safe_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    # Save physical file
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    # Save DB record
    doc = Document(
        user_id=current_user.id,
        document_type=document_type,
        file_path=file_path,
        original_filename=file.filename,
        file_size_bytes=file_size,
        expiration_date=expiration_date
    )
    
    session.add(doc)
    session.commit()
    session.refresh(doc)
    
    # Audit log
    _log_audit(
        session=session,
        user_id=current_user.id,
        action="UPLOAD_DOCUMENT",
        entity_type="Document",
        entity_id=doc.id,
        details=f"Uploaded {document_type} file: {file.filename}"
    )
    session.commit()
    
    return doc

def get_documents(session: Session, current_user: User) -> List[Document]:
    # If admin/recruiter, return all documents. Otherwise just user's.
    if current_user.has_permission("view_all_resumes"):
        return session.exec(select(Document).order_by(Document.uploaded_at.desc())).all()
    else:
        return session.exec(
            select(Document).where(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc())
        ).all()

def get_user_documents(session: Session, target_user_id: int, current_user: User) -> List[Document]:
    # Ensure they have permission to view other users' docs
    if not current_user.has_permission("view_all_resumes"):
        raise ValueError("You do not have permission to view this user's documents")
    
    return session.exec(
        select(Document)
        .where(Document.user_id == target_user_id)
        .order_by(Document.uploaded_at.desc())
    ).all()

def download_document(session: Session, doc_id: int, current_user: User) -> FileResponse:
    doc = session.get(Document, doc_id)
    if not doc:
        raise ValueError("Document not found")
        
    # Permission check
    if doc.user_id != current_user.id and not current_user.has_permission("view_all_resumes"):
        raise ValueError("You do not have permission to view this document")
        
    if not os.path.exists(doc.file_path):
        raise ValueError("File is missing from storage")
        
    # Audit log
    _log_audit(
        session=session,
        user_id=current_user.id,
        action="DOWNLOAD_DOCUMENT",
        entity_type="Document",
        entity_id=doc.id,
        details=f"Downloaded {doc.document_type} file: {doc.original_filename}"
    )
    session.commit()
    
    return FileResponse(
        path=doc.file_path,
        filename=doc.original_filename,
        media_type="application/octet-stream"
    )

def delete_document(session: Session, doc_id: int, current_user: User):
    doc = session.get(Document, doc_id)
    if not doc:
        raise ValueError("Document not found")
        
    # Permission check
    if doc.user_id != current_user.id and not current_user.has_permission("manage_users"): # Only admins can delete other's docs
        raise ValueError("You do not have permission to delete this document")
        
    # Delete physical file
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
        
    session.delete(doc)
    
    # Audit log
    _log_audit(
        session=session,
        user_id=current_user.id,
        action="DELETE_DOCUMENT",
        entity_type="Document",
        entity_id=0, # Destroyed
        details=f"Deleted {doc.document_type} file: {doc.original_filename}"
    )
    session.commit()
    return True
