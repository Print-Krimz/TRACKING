"""
Role Model

Defines user roles that group permissions together.
This is the middle tier of the RBAC hierarchy.

Default Roles:
1. Admin: Full system access, can manage users and roles
2. Recruiter: Can view all resumes and trigger AI analysis
3. Applicant: Can submit and view their own resumes

Architecture Decision:
- Roles are stored in the database for flexibility
- Role-Permission mapping allows runtime modification
- Users are assigned exactly one role (simplifies permission logic)
"""

from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, Relationship, SQLModel

from models.permission import Permission, RolePermissionLink

if TYPE_CHECKING:
    from models.user import User


class Role(SQLModel, table=True):
    """
    Role model representing a named collection of permissions.
    
    Roles provide a convenient way to group permissions and assign them
    to users. Instead of assigning individual permissions to each user,
    we assign a role that bundles related permissions together.
    
    Attributes:
        id: Unique identifier (auto-generated primary key)
        name: Role name (e.g., 'Admin', 'Recruiter', 'Applicant')
              Must be unique across the system
        permissions: List of Permission objects assigned to this role
                    Loaded via the many-to-many relationship
        users: List of User objects with this role (back-populated)
    
    Role Hierarchy (by permission scope):
        Admin > Recruiter > Applicant
    
    Example permission assignments:
        Admin:
            - view_own_resume, view_all_resumes
            - submit_resume, analyze_resume
            - manage_users, manage_roles
        
        Recruiter:
            - view_all_resumes
            - analyze_resume
        
        Applicant:
            - view_own_resume
            - submit_resume
    """
    __tablename__ = "role"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(
        unique=True, 
        index=True,
        description="Unique role name (e.g., 'Admin', 'Recruiter', 'Applicant')"
    )
    
    # Many-to-many relationship with Permission via the link table
    # This allows a role to have multiple permissions
    permissions: List[Permission] = Relationship(
        link_model=RolePermissionLink,
        sa_relationship_kwargs={
            "lazy": "selectin"  # Eager load permissions when querying roles
        }
    )
    
    # One-to-many relationship with User (back-populated)
    # This allows easy access to all users with a given role
    users: List["User"] = Relationship(back_populates="role")
    
    def has_permission(self, permission_name: str) -> bool:
        """
        Check if this role has a specific permission.
        
        This method is used in the RBAC enforcement logic to determine
        if a user (via their role) is allowed to perform an action.
        
        Args:
            permission_name: The name of the permission to check
                           (e.g., 'analyze_resume')
        
        Returns:
            bool: True if the role has the permission, False otherwise
        
        Example:
            if user.role.has_permission('analyze_resume'):
                # Proceed with resume analysis
        """
        return any(p.name == permission_name for p in self.permissions)
