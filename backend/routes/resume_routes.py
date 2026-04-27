"""
Resume Routes

API endpoints for resume operations including submission,
retrieval, and AI analysis.

Protected Routes (authentication required):
- POST /resumes - Submit a new resume (Applicant)
- POST /resumes/upload - Upload a resume file (Applicant)
- GET /resumes - List resumes (filtered by role)
- GET /resumes/{id} - Get specific resume
- POST /resumes/{id}/analyze - Trigger AI analysis (Recruiter/Admin)
- DELETE /resumes/{id} - Delete a resume
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user, check_permissions
from models.user import User
from schemas.resume import (
    ResumeSubmitRequest,
    ResumeResponse,
    ResumeListResponse,
    ResumeAnalysisResponse,
    AnalyzeResumeRequest
)
from models.controllers.resume_controller import (
    submit_resume,
    submit_resume_file,
    get_resumes,
    get_resume_by_id,
    analyze_resume,
    delete_resume
)

# Create the router with prefix and tags
router = APIRouter(
    prefix="/resumes",
    tags=["Resumes"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Permission denied"},
        404: {"description": "Resume not found"}
    }
)


@router.post(
    "/",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new resume",
    description="""
    Submit a new resume for the current user.
    
    **Required Permission:** `submit_resume` (Applicant)
    
    The resume content should be the full text of the resume.
    Minimum 50 characters required.
    """
)
def create_resume(
    request: ResumeSubmitRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("submit_resume"))
):
    """
    Submit resume endpoint.
    
    RBAC: Only users with 'submit_resume' permission (Applicants) can submit.
    Each resume is associated with the submitting user.
    
    Args:
        request: Resume content
        session: Database session
        current_user: Authenticated applicant user
    
    Returns:
        ResumeResponse: The created resume
    """
    return submit_resume(session, current_user, request)


# Maximum file size: 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx"}


@router.post(
    "/upload",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a resume file",
    description="""
    Upload a resume file (PDF or DOCX) for the current user.
    
    **Required Permission:** `submit_resume` (Applicant)
    
    **Supported formats:** PDF, DOCX
    **Maximum file size:** 5MB
    
    The file content will be extracted and stored as text for AI analysis.
    """
)
async def upload_resume(
    file: UploadFile = File(..., description="Resume file (PDF or DOCX)"),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("submit_resume"))
):
    """
    Upload resume file endpoint.
    
    RBAC: Only users with 'submit_resume' permission (Applicants) can upload.
    
    Validates:
    - File type (PDF or DOCX only)
    - File size (max 5MB)
    
    Args:
        file: Uploaded file
        session: Database session
        current_user: Authenticated applicant user
    
    Returns:
        ResumeResponse: The created resume with extracted text
    """
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
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )
    
    # Process file and create resume
    try:
        return submit_resume_file(
            session=session,
            current_user=current_user,
            file_content=content,
            filename=file.filename,
            file_type=file_ext
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/",
    response_model=ResumeListResponse,
    summary="List resumes",
    description="""
    Retrieve resumes based on user permissions.
    
    **Applicants:** See only their own resumes
    **Recruiters/Admins:** See all resumes in the system
    
    **Required:** Authentication
    """
)
def list_resumes(
    page: int = 1,
    limit: int = 50,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List resumes endpoint.
    
    RBAC Logic:
    - Users with 'view_all_resumes' permission see all resumes
    - Others see only their own resumes
    
    This logic is implemented in the controller.
    
    Args:
        session: Database session
        current_user: Authenticated user
    
    Returns:
        ResumeListResponse: List of accessible resumes
    """
    skip = (page - 1) * limit
    response, _, _ = get_resumes(session, current_user, skip, limit)
    return response


@router.get(
    "/{resume_id}",
    response_model=ResumeResponse,
    summary="Get resume by ID",
    description="""
    Retrieve a specific resume.
    
    **Applicants:** Can only access their own resumes
    **Recruiters/Admins:** Can access any resume
    
    **Required:** Authentication
    """
)
def get_resume(
    resume_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get resume by ID endpoint.
    
    RBAC: Access is checked in the controller based on ownership
    and user permissions.
    
    Args:
        resume_id: ID of the resume to retrieve
        session: Database session
        current_user: Authenticated user
    
    Returns:
        ResumeResponse: The requested resume
    
    Raises:
        HTTPException 404/403: If not found or access denied
    """
    try:
        return get_resume_by_id(session, resume_id, current_user)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )


@router.post(
    "/{resume_id}/analyze",
    response_model=ResumeAnalysisResponse,
    summary="Analyze resume with AI",
    description="""
    Trigger AI analysis on a resume using Google Gemini.
    
    **Required Permission:** `analyze_resume` (Recruiter/Admin only)
    
    The analysis includes:
    - Overall score (1-10)
    - Key strengths
    - Areas for improvement
    - Summary assessment
    - Recommendations
    
    **Note:** Analysis may take a few seconds.
    """
)
def trigger_analysis(
    resume_id: int,
    request: AnalyzeResumeRequest = AnalyzeResumeRequest(),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("analyze_resume"))
):
    """
    Analyze resume endpoint.
    
    RBAC: Only users with 'analyze_resume' permission can trigger analysis.
    This is the key permission that separates Recruiters from Applicants.
    
    Check if user role includes 'analyze_resume' permission before 
    calling Gemini API.
    
    Args:
        resume_id: ID of the resume to analyze
        request: Analysis parameters (optional job role context)
        session: Database session
        current_user: Authenticated recruiter/admin user
    
    Returns:
        ResumeAnalysisResponse: Resume with AI analysis result
    
    Raises:
        HTTPException 404: If resume not found
    """
    try:
        return analyze_resume(session, resume_id, current_user, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete(
    "/{resume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a resume",
    description="""
    Delete a resume.
    
    **Applicants:** Can delete only their own resumes
    **Admins:** Can delete any resume
    
    **Required:** Authentication
    """
)
def remove_resume(
    resume_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete resume endpoint.
    
    RBAC: Owners can delete their resumes, admins can delete any.
    
    Args:
        resume_id: ID of the resume to delete
        session: Database session
        current_user: Authenticated user
    
    Raises:
        HTTPException 404/403: If not found or access denied
    """
    try:
        delete_resume(session, resume_id, current_user)
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
