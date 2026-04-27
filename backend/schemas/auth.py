"""
Authentication Schemas

Pydantic schemas for authentication-related request and response validation.
These schemas define the data contract between the API and clients.

Schema Types:
- Request schemas: Validate incoming data from clients
- Response schemas: Define the structure of API responses
- Internal schemas: Used for data transfer within the application
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    """
    JWT Token response returned after successful authentication.
    
    This is the response format for the /auth/login endpoint.
    The client should store this token and include it in the
    Authorization header for subsequent requests.
    
    Attributes:
        access_token: The JWT token string
        token_type: Always "bearer" for JWT tokens
    
    Usage:
        Authorization: Bearer <access_token>
    """
    access_token: str = Field(description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type (always 'bearer')")


class TokenData(BaseModel):
    """
    Internal schema for decoded JWT token data.
    
    This schema represents the payload extracted from a valid JWT token.
    Used internally by the authentication dependency to pass user identity.
    
    Attributes:
        username: The username extracted from the token's 'sub' claim
    """
    username: Optional[str] = Field(default=None, description="Username from token 'sub' claim")


class LoginRequest(BaseModel):
    """
    Request schema for user login.
    
    Validates the login form data submitted by the client.
    
    Attributes:
        username: The user's username
        password: The user's plain-text password (will be verified against hash)
    """
    username: str = Field(
        min_length=3, 
        max_length=50,
        description="Username for authentication"
    )
    password: str = Field(
        min_length=6,
        description="Password for authentication"
    )


class RegisterRequest(BaseModel):
    """
    Request schema for user registration.
    
    Validates new user registration data. The password will be hashed
    before storage - never store plain-text passwords!
    
    Attributes:
        username: Desired username (must be unique)
        email: User's email address (must be unique, validated format)
        password: Desired password (will be hashed with bcrypt)
        role_name: The role to assign (default: "Applicant")
                  Only Admins can register users with elevated roles
    """
    username: str = Field(
        min_length=3, 
        max_length=50,
        description="Desired username (must be unique)"
    )
    email: EmailStr = Field(description="Email address (must be unique)")
    password: str = Field(
        min_length=6,
        description="Password (min 6 characters)"
    )
    role_name: str = Field(
        default="Applicant",
        description="Role to assign during self-registration: 'Applicant', 'Recruiter', or legacy 'Candidate'"
    )


class UserResponse(BaseModel):
    """
    Response schema for user data in API responses.
    
    This schema excludes sensitive data (like hashed_password) and
    includes only the information safe to return to clients.
    
    Attributes:
        id: User's unique identifier
        username: User's username
        email: User's email address
        role_name: Name of the user's assigned role
    """
    id: int
    username: str
    email: str
    role_name: Optional[str] = Field(default=None, description="User's role name")
    
    class Config:
        """Pydantic config to allow ORM mode for SQLModel compatibility."""
        from_attributes = True


class LoginResponse(BaseModel):
    """
    Complete login response including token and user info.
    
    Provides both the authentication token and user details
    so the client can immediately use both without an extra API call.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
