"""
User Model

Defines the User entity for authentication and authorization.
Users are the primary actors in the system with roles and resumes.

Security Considerations:
- Passwords are NEVER stored in plain text
- We use passlib with bcrypt for secure password hashing
- The hashed_password field should never be returned in API responses
"""

from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from models.role import Role
    from models.resume import Resume
    from models.document import Document
    from models.audit_log import AuditLog


class User(SQLModel, table=True):
    """
    User model representing an authenticated user in the system.
    
    Each user has:
    - Authentication credentials (username, email, hashed password)
    - A role that determines their permissions
    - Associated resumes (for Applicant users)
    
    Attributes:
        id: Unique identifier (auto-generated primary key)
        username: Unique username for login
        email: Unique email address (used for notifications/recovery)
        hashed_password: bcrypt-hashed password (NEVER store plain text!)
        role_id: Foreign key to the user's assigned role
        role: Role object (lazy-loaded relationship)
        resumes: List of Resume objects owned by this user
    
    Security Notes:
        - The hashed_password uses bcrypt with automatic salting
        - Password verification should use passlib's verify method
        - API responses should exclude hashed_password (use Pydantic schemas)
    """
    __tablename__ = "user"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(
        unique=True, 
        index=True,
        min_length=3,
        max_length=50,
        description="Unique username for authentication"
    )
    email: str = Field(
        unique=True, 
        index=True,
        description="Unique email address"
    )
    phone: Optional[str] = Field(default=None, max_length=30)
    location: Optional[str] = Field(default=None, max_length=120)
    current_title: Optional[str] = Field(default=None, max_length=120)
    years_experience: Optional[int] = Field(default=None, ge=0)
    linkedin_url: Optional[str] = Field(default=None, max_length=255)
    portfolio_url: Optional[str] = Field(default=None, max_length=255)
    professional_summary: Optional[str] = Field(default=None, max_length=2000)
    hashed_password: str = Field(
        description="bcrypt-hashed password - NEVER store or return plain text"
    )
    
    # Foreign key to Role table
    # Each user must have exactly one role
    role_id: Optional[int] = Field(
        default=None, 
        foreign_key="role.id",
        description="Foreign key to the user's role"
    )
    
    # Relationship to Role - provides access to user's permissions
    role: Optional["Role"] = Relationship(
        back_populates="users",
        sa_relationship_kwargs={"lazy": "selectin"}  # Eager load role with user
    )
    
    # One-to-many relationship with Resume
    # Applicant users can have multiple resumes
    resumes: List["Resume"] = Relationship(back_populates="user")
    
    # One-to-many relationship with Document (Digital 201 File)
    documents: List["Document"] = Relationship(back_populates="user")
    
    # One-to-many relationship with AuditLog
    audit_logs: List["AuditLog"] = Relationship(back_populates="user")
    
    def has_permission(self, permission_name: str) -> bool:
        """
        Check if the user has a specific permission via their role.
        
        This is a convenience method that delegates to the role's
        has_permission method. Used throughout the application for
        authorization checks.
        
        Args:
            permission_name: The permission to check (e.g., 'analyze_resume')
        
        Returns:
            bool: True if user's role has the permission, False otherwise
        
        Example:
            if current_user.has_permission('manage_users'):
                # Admin-only functionality
        """
        if self.role is None:
            return False
        return self.role.has_permission(permission_name)
