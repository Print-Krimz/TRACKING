"""
Authentication Dependencies

FastAPI dependencies for JWT authentication and RBAC permission checking.
These dependencies are used to protect API endpoints.

Security Flow:
1. User logs in and receives a JWT token
2. Client includes token in Authorization header
3. get_current_user validates token and retrieves user
4. check_permissions verifies user has required permission

Key Components:
- JWT token creation and validation
- Password hashing and verification
- FastAPI dependency injection for auth
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from database import get_session
from models.user import User
from schemas.auth import TokenData

# Load environment variables
load_dotenv()

# JWT Configuration
# SECRET_KEY should be a long, random string - NEVER commit the real key to git
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"  # HMAC-SHA256 for JWT signing
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# OAuth2 scheme for Bearer token authentication
# tokenUrl points to the login endpoint that issues tokens
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# =============================================================================
# Password Hashing Functions
# =============================================================================

def hash_password(password: str) -> str:
    """
    Hash a plain-text password using bcrypt.
    
    bcrypt automatically generates a random salt and includes it
    in the output hash. This ensures that identical passwords
    produce different hashes.
    
    Args:
        password: The plain-text password to hash
    
    Returns:
        str: The hashed password (includes salt)
    
    Example:
        hashed = hash_password("mysecretpassword")
        # Returns something like: $2b$12$...
    """
    # Truncate password to 72 bytes (bcrypt limitation)
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a hashed password.
    
    This function safely compares the password using constant-time
    comparison to prevent timing attacks.
    
    Args:
        plain_password: The plain-text password to verify
        hashed_password: The hashed password from the database
    
    Returns:
        bool: True if password matches, False otherwise
    """
    # Truncate password to 72 bytes (bcrypt limitation)
    password_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# =============================================================================
# JWT Token Functions
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token with the given payload.
    
    The token includes:
    - The provided data (typically including 'sub' for subject/username)
    - An expiration time ('exp' claim)
    
    Args:
        data: Dictionary of claims to include in the token
              Must include 'sub' (subject) for user identification
        expires_delta: Optional custom expiration time
                      Defaults to ACCESS_TOKEN_EXPIRE_MINUTES
    
    Returns:
        str: The encoded JWT token string
    
    Example:
        token = create_access_token({"sub": "username"})
        # Returns: eyJhbGciOiJIUzI1NiIs...
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # Encode the JWT with our secret key
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    Decode and validate a JWT access token.
    
    This function:
    1. Decodes the token using our secret key
    2. Validates the signature
    3. Checks the expiration time
    4. Extracts the username from the 'sub' claim
    
    Args:
        token: The JWT token string to decode
    
    Returns:
        TokenData: Object containing the decoded username, or None if invalid
    
    Example:
        token_data = decode_access_token(token)
        if token_data:
            print(f"User: {token_data.username}")
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return TokenData(username=username)
    except JWTError:
        return None


# =============================================================================
# FastAPI Dependency Injection
# =============================================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
) -> User:
    """
    FastAPI dependency to get the currently authenticated user.
    
    This dependency:
    1. Extracts the JWT token from the Authorization header
    2. Decodes and validates the token
    3. Retrieves the user from the database
    4. Returns the user object with role loaded
    
    Usage:
        @app.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            return {"message": f"Hello, {current_user.username}!"}
    
    Args:
        token: JWT token from Authorization header (injected)
        session: Database session (injected)
    
    Returns:
        User: The authenticated user object with role relationship loaded
    
    Raises:
        HTTPException 401: If token is invalid or user not found
    """
    # Standard exception for authentication failures
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Decode the token
    token_data = decode_access_token(token)
    if token_data is None or token_data.username is None:
        raise credentials_exception
    
    # Query the database for the user
    # The role relationship is eager-loaded due to "selectin" config
    statement = select(User).where(User.username == token_data.username)
    user = session.exec(statement).first()
    
    if user is None:
        raise credentials_exception

    if (user.status or "active") != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is archived. Contact an administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


def check_permissions(required_permission: str):
    """
    Factory function that creates a dependency for permission checking.
    
    This is a higher-order function that returns a dependency function.
    The returned function checks if the current user has the specified
    permission via their role.
    
    RBAC Flow:
        User -> Role -> [Permissions]
        
    If the user's role includes the required permission, access is granted.
    Otherwise, a 403 Forbidden error is raised.
    
    Usage:
        @app.post("/resumes/{id}/analyze")
        def analyze_resume(
            resume_id: int,
            current_user: User = Depends(check_permissions("analyze_resume"))
        ):
            # Only users with 'analyze_resume' permission can access this
    
    Args:
        required_permission: The permission name to check (e.g., 'analyze_resume')
    
    Returns:
        A dependency function that returns the User if authorized
    
    Raises:
        HTTPException 403: If user lacks the required permission
    """
    
    async def permission_dependency(
        current_user: User = Depends(get_current_user)
    ) -> User:
        """
        Inner dependency that performs the actual permission check.
        
        This function is returned by check_permissions and is what
        FastAPI actually calls for dependency injection.
        """
        # Check if user has the required permission via their role
        if not current_user.has_permission(required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: '{required_permission}'"
            )
        return current_user
    
    return permission_dependency


# =============================================================================
# Utility Functions
# =============================================================================

def get_user_by_username(session: Session, username: str) -> Optional[User]:
    """
    Retrieve a user by their username.
    
    Helper function used during authentication to find the user
    whose credentials are being verified.
    
    Args:
        session: Database session
        username: The username to look up
    
    Returns:
        User if found, None otherwise
    """
    statement = select(User).where(User.username == username)
    return session.exec(statement).first()


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    """
    Retrieve a user by their email address.
    
    Used during registration to check for duplicate emails.
    
    Args:
        session: Database session
        email: The email to look up
    
    Returns:
        User if found, None otherwise
    """
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()
