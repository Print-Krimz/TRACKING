"""
User Schemas

Pydantic schemas for user management operations.
Used by the user controller for admin operations like listing users and assigning roles.
"""

from typing import List, Optional
from pydantic import AnyHttpUrl, BaseModel, Field


class UserBase(BaseModel):
    """
    Base user schema with common fields.
    
    Used as a base class for other user-related schemas.
    """
    username: str
    email: str


class UserWithRole(BaseModel):
    """
    User schema including role information.
    
    Used when returning user data that includes their role details.
    """
    id: int
    username: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    current_title: Optional[str] = None
    years_experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    professional_summary: Optional[str] = None
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """
    Response schema for listing multiple users.
    
    Used by the GET /users endpoint (Admin only).
    """
    users: List[UserWithRole]
    total: int = Field(description="Total number of users")


class AssignRoleRequest(BaseModel):
    """
    Request schema for assigning a role to a user.
    
    Used by the PUT /users/{user_id}/role endpoint (Admin only).
    
    Attributes:
        role_name: The name of the role to assign
                  Must match an existing role in the database
    """
    role_name: str = Field(
        description="Name of the role to assign (e.g., 'Admin', 'Recruiter', 'Applicant')"
    )


class UserUpdateRequest(BaseModel):
    """
    Request schema for updating a user's basic profile.
    """
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[str] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    location: Optional[str] = Field(default=None, max_length=120)
    current_title: Optional[str] = Field(default=None, max_length=120)
    years_experience: Optional[int] = Field(default=None, ge=0)
    linkedin_url: Optional[AnyHttpUrl] = None
    portfolio_url: Optional[AnyHttpUrl] = None
    professional_summary: Optional[str] = Field(default=None, max_length=2000)


class PasswordChangeRequest(BaseModel):
    """
    Request schema for changing password securely.
    """
    current_password: str
    new_password: str = Field(min_length=6)


class PermissionResponse(BaseModel):
    """
    Response schema for permission data.
    """
    id: int
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    """
    Response schema for role data including permissions.
    """
    id: int
    name: str
    permissions: List[PermissionResponse] = []
    
    class Config:
        from_attributes = True
