"""
Schemas Package

This package contains all Pydantic schemas for request/response validation.
Schemas define the data contract between the API and its clients.

Organization:
- auth.py: Authentication schemas (login, register, tokens)
- user.py: User management schemas (list, assign role)
- resume.py: Resume operation schemas (submit, analyze)
"""

from schemas.auth import (
    TokenResponse,
    TokenData,
    LoginRequest,
    RegisterRequest,
    UserResponse,
    LoginResponse,
)
from schemas.user import (
    UserBase,
    UserWithRole,
    UserListResponse,
    AssignRoleRequest,
    PermissionResponse,
    RoleResponse,
)
from schemas.resume import (
    ResumeSubmitRequest,
    ResumeResponse,
    ResumeListResponse,
    ResumeAnalysisResponse,
    AnalyzeResumeRequest,
)

__all__ = [
    # Auth schemas
    "TokenResponse",
    "TokenData",
    "LoginRequest",
    "RegisterRequest",
    "UserResponse",
    "LoginResponse",
    # User schemas
    "UserBase",
    "UserWithRole",
    "UserListResponse",
    "AssignRoleRequest",
    "PermissionResponse",
    "RoleResponse",
    # Resume schemas
    "ResumeSubmitRequest",
    "ResumeResponse",
    "ResumeListResponse",
    "ResumeAnalysisResponse",
    "AnalyzeResumeRequest",
]
