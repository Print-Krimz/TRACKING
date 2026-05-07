from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models.user import User
from schemas.document import DocumentResponse, DocumentListResponse, DocumentMetadataUpdateRequest
from models.controllers.document_controller import (
    submit_document_file,
    get_documents,
    get_user_documents,
    download_document,
    delete_document,
    confirm_document_metadata,
)

# Create the router with prefix and tags
router = APIRouter(
    prefix="/documents",
    tags=["Documents (201 File)"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Permission denied"},
        404: {"description": "Document not found"}
    }
)

MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "jpeg", "jpg", "png"}

@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document for the Digital 201 File"
)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(..., description="E.g., Resume, ID, Contract, Certification"),
    expiration_date: Optional[datetime] = Form(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Validate file extension
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided"
        )
    
    file_ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Process and save
    try:
        doc = submit_document_file(
            session=session,
            current_user=current_user,
            file=file,
            document_type=document_type,
            expiration_date=expiration_date
        )
        return doc
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/", response_model=DocumentListResponse)
def list_documents(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    docs = get_documents(session, current_user)
    return DocumentListResponse(documents=docs, total=len(docs))


@router.patch("/{doc_id}/metadata", response_model=DocumentResponse)
def update_document_metadata(
    doc_id: int,
    request: DocumentMetadataUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    try:
        return confirm_document_metadata(
            session=session,
            doc_id=doc_id,
            current_user=current_user,
            document_type=request.document_type,
            expiration_date=request.expiration_date,
        )
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_msg)

@router.get("/user/{user_id}", response_model=DocumentListResponse)
def list_user_documents(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    try:
        docs = get_user_documents(session, user_id, current_user)
        return DocumentListResponse(documents=docs, total=len(docs))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

@router.get("/{doc_id}/download")
def download_doc(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    try:
        return download_document(session, doc_id, current_user)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "missing" in error_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_msg)

@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(
    doc_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    try:
        delete_document(session, doc_id, current_user)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error_msg)
