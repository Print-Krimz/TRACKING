"""
Authentication Controller

Business logic for user authentication and registration.
This controller handles login, registration, and token management.

Security Notes:
- Passwords are hashed using bcrypt before storage
- JWT tokens are issued upon successful login
- Registration validates uniqueness of username and email
"""

from typing import Optional
from sqlmodel import Session, select

from models.user import User
from models.role import Role
from schemas.auth import RegisterRequest, LoginRequest, UserResponse, LoginResponse
from dependencies import hash_password, verify_password, create_access_token


def register_user(session: Session, request: RegisterRequest) -> UserResponse:
    """
    Register a new user in the system.
    
    This function:
    1. Validates that username and email are unique
    2. Finds the specified role (defaults to 'Applicant')
    3. Hashes the password using bcrypt
    4. Creates the user record in the database
    
    RBAC Consideration:
        By default, new users are assigned the 'Applicant' role.
        Only admins can register users with elevated roles (Admin, Recruiter).
        This is enforced at the route level, not here.
    
    Args:
        session: Database session
        request: Registration data (username, email, password, role_name)
    
    Returns:
        UserResponse: The created user's public data (excludes password)
    
    Raises:
        ValueError: If username or email already exists, or role not found
    """
    # Check if username already exists
    existing_user = session.exec(
        select(User).where(User.username == request.username)
    ).first()
    if existing_user:
        raise ValueError(f"Username '{request.username}' is already taken")
    
    # Check if email already exists
    existing_email = session.exec(
        select(User).where(User.email == request.email)
    ).first()
    if existing_email:
        raise ValueError(f"Email '{request.email}' is already registered")
    
    # Find the role by name
    role = session.exec(
        select(Role).where(Role.name == request.role_name)
    ).first()
    if not role:
        raise ValueError(f"Role '{request.role_name}' not found")
    
    # Create the new user with hashed password
    # NEVER store plain-text passwords!
    new_user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(request.password),
        role_id=role.id
    )
    
    # Add to database and commit
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    # Return user response (excludes password)
    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        phone=new_user.phone,
        location=new_user.location,
        current_title=new_user.current_title,
        years_experience=new_user.years_experience,
        linkedin_url=new_user.linkedin_url,
        portfolio_url=new_user.portfolio_url,
        professional_summary=new_user.professional_summary,
        role_name=role.name
    )


def authenticate_user(session: Session, username: str, password: str) -> Optional[User]:
    """
    Authenticate a user by username and password.
    
    This function:
    1. Looks up the user by username
    2. Verifies the password against the stored hash
    3. Returns the user if authentication succeeds
    
    Args:
        session: Database session
        username: The username to authenticate
        password: The plain-text password to verify
    
    Returns:
        User if authentication succeeds, None otherwise
    
    Security Note:
        We don't differentiate between "user not found" and "wrong password"
        in the return value. This prevents username enumeration attacks.
    """
    # Query for the user
    user = session.exec(
        select(User).where(User.username == username)
    ).first()
    
    if not user:
        # User not found - but we don't reveal this to prevent enumeration
        return None
    
    # Verify the password using bcrypt
    if not verify_password(password, user.hashed_password):
        return None
    
    return user


def login_user(session: Session, request: LoginRequest) -> LoginResponse:
    """
    Log in a user and issue a JWT token.
    
    This function:
    1. Authenticates the user (username + password)
    2. Creates a JWT access token
    3. Returns the token with user information
    
    Args:
        session: Database session
        request: Login credentials (username, password)
    
    Returns:
        LoginResponse: JWT token and user information
    
    Raises:
        ValueError: If authentication fails
    """
    # Authenticate the user
    user = authenticate_user(session, request.username, request.password)
    
    if not user:
        raise ValueError("Invalid username or password")
    
    # Create JWT token with username as the subject
    access_token = create_access_token(data={"sub": user.username})
    
    # Get role name for response
    role_name = user.role.name if user.role else None
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            phone=user.phone,
            location=user.location,
            current_title=user.current_title,
            years_experience=user.years_experience,
            linkedin_url=user.linkedin_url,
            portfolio_url=user.portfolio_url,
            professional_summary=user.professional_summary,
            role_name=role_name
        )
    )
