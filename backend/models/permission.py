"""
Permission Model

Defines granular permissions that can be assigned to roles.
This enables fine-grained access control beyond simple role checks.

Permissions in this system:
- view_own_resume: Applicants can view their own resumes
- view_all_resumes: Recruiters/Admins can view all resumes
- submit_resume: Applicants can submit resumes
- analyze_resume: Recruiters/Admins can trigger AI analysis
- manage_users: Admins can manage user accounts
- manage_roles: Admins can assign roles to users

Architecture Decision:
- Many-to-many relationship with Role via RolePermissionLink
- This allows flexible permission assignment without code changes
"""

from typing import TYPE_CHECKING, Optional
from sqlmodel import Field, SQLModel

# TYPE_CHECKING prevents circular imports while maintaining type hints
if TYPE_CHECKING:
    pass


class RolePermissionLink(SQLModel, table=True):
    """
    Association table for the many-to-many relationship between Role and Permission.
    
    This link table allows:
    - A role to have multiple permissions
    - A permission to be assigned to multiple roles
    
    Example:
        Admin role -> [view_all_resumes, analyze_resume, manage_users, manage_roles]
        Recruiter role -> [view_all_resumes, analyze_resume]
        Applicant role -> [view_own_resume, submit_resume]
    """
    __tablename__ = "role_permission_link"
    
    # Composite primary key from both foreign keys
    role_id: Optional[int] = Field(
        default=None, 
        foreign_key="role.id", 
        primary_key=True,
        description="Foreign key to Role table"
    )
    permission_id: Optional[int] = Field(
        default=None, 
        foreign_key="permission.id", 
        primary_key=True,
        description="Foreign key to Permission table"
    )


class Permission(SQLModel, table=True):
    """
    Permission model representing a single, granular access right.
    
    Permissions are the atomic units of access control in the RBAC system.
    They define WHAT actions a user can perform, while Roles group these
    permissions into logical bundles.
    
    Attributes:
        id: Unique identifier (auto-generated primary key)
        name: Machine-readable permission identifier (e.g., 'analyze_resume')
              Used in code for permission checks
        description: Human-readable description of what this permission allows
    
    Usage in permission checks:
        @check_permissions("analyze_resume")
        async def analyze(resume_id: int):
            # Only users whose role has 'analyze_resume' permission can access
    """
    __tablename__ = "permission"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(
        unique=True, 
        index=True,
        description="Unique permission identifier (e.g., 'view_resume', 'analyze_resume')"
    )
    description: Optional[str] = Field(
        default=None,
        description="Human-readable description of the permission"
    )
