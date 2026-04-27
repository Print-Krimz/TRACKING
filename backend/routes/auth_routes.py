"""
Authentication Routes

API endpoints for user authentication and registration.
These routes handle login, registration, and token-related operations.

Public Routes (no authentication required):
- POST /auth/register - Create a new user account
- POST /auth/login - Authenticate and receive JWT token
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from database import get_session
from schemas.auth import RegisterRequest, LoginResponse, UserResponse
from models.controllers.auth_controller import register_user, login_user
from schemas.auth import LoginRequest

# Create the router with a prefix and tags for OpenAPI documentation
router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
    responses={
        401: {"description": "Authentication failed"},
        400: {"description": "Invalid input"}
    }
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="""
    Create a new user account in the system.
    
    By default, new users are assigned the 'Applicant' role.
    To register as a Recruiter, specify role_name: 'Recruiter'.
    Elevated roles (Admin / Control Panel Admin) must be assigned by admins.
    
    **Password Requirements:**
    - Minimum 6 characters
    
    **Returns:** Created user information (excluding password)
    """
)
def register(
    request: RegisterRequest,
    session: Session = Depends(get_session)
):
    """
    Register endpoint handler.
    
    This endpoint is PUBLIC - no authentication required.
    Anyone can register as an Applicant or Recruiter.
    
    Args:
        request: Registration data from request body
        session: Database session (injected by FastAPI)
    
    Returns:
        UserResponse: The created user's public data
    
    Raises:
        HTTPException 400: If username/email already exists or role not found
    """
    allowed_self_registration_roles = {"Applicant", "Recruiter", "Candidate"}
    if request.role_name not in allowed_self_registration_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Elevated roles can only be assigned by an admin."
        )

    try:
        return register_user(session, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login to get access token",
    description="""
    Authenticate with username and password to receive a JWT access token.
    
    Include the token in subsequent requests using the Authorization header:
    ```
    Authorization: Bearer <access_token>
    ```
    
    **Returns:** JWT token and user information including role
    """
)
def login(
    request: LoginRequest,
    session: Session = Depends(get_session)
):
    """
    Login endpoint handler.
    
    This endpoint is PUBLIC - no authentication required.
    
    The returned token should be stored by the client and included
    in the Authorization header for protected routes.
    
    Args:
        request: Login credentials from request body
        session: Database session (injected by FastAPI)
    
    Returns:
        LoginResponse: JWT token and user information
    
    Raises:
        HTTPException 401: If credentials are invalid
    """
    try:
        return login_user(session, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )


@router.post(
    "/token",
    response_model=LoginResponse,
    summary="OAuth2 compatible token endpoint",
    include_in_schema=False  # Hide from docs (use /login instead)
)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    """
    OAuth2 compatible login endpoint.
    
    This endpoint is used by OAuth2PasswordRequestForm for Swagger UI
    authentication. It accepts form data instead of JSON.
    
    Args:
        form_data: OAuth2 form with username and password
        session: Database session
    
    Returns:
        LoginResponse: JWT token and user information
    """
    request = LoginRequest(
        username=form_data.username,
        password=form_data.password
    )
    try:
        return login_user(session, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
