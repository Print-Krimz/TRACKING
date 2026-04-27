"""
Controllers Package

Business logic layer for the RBAC Resume Application.
Controllers contain the core application logic, separate from HTTP concerns.
"""

from .auth_controller import register_user, login_user, authenticate_user
from .user_controller import get_all_users, get_user_by_id, assign_role_to_user, get_all_roles
from .resume_controller import (
    submit_resume,
    get_resumes,
    get_resume_by_id,
    analyze_resume,
    delete_resume,
)

__all__ = [
    # Auth
    "register_user",
    "login_user",
    "authenticate_user",
    # User
    "get_all_users",
    "get_user_by_id",
    "assign_role_to_user",
    "get_all_roles",
    # Resume
    "submit_resume",
    "get_resumes",
    "get_resume_by_id",
    "analyze_resume",
    "delete_resume",
]
