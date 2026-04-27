"""
User Controller

Business logic for user management operations.
These functions are typically restricted to Admin users.

Features:
- List all users
- Get user by ID
- Assign roles to users
- Update user information
"""

from typing import List, Optional
from sqlmodel import Session, select

from models.user import User
from models.role import Role
from schemas.user import UserWithRole, UserListResponse, AssignRoleRequest, UserUpdateRequest, PasswordChangeRequest
from dependencies import hash_password, verify_password


def get_all_users(session: Session) -> UserListResponse:
    """
    Retrieve all users in the system.
    
    This function is restricted to Admin users via route-level
    permission checking.
    
    RBAC Requirement:
        Permission: 'manage_users' (Admin only)
    
    Args:
        session: Database session
    
    Returns:
        UserListResponse: List of all users with their roles
    """
    # Query all users with their roles
    users = session.exec(select(User)).all()
    
    # Convert to response format
    user_list = []
    for user in users:
        user_list.append(UserWithRole(
            id=user.id,
            username=user.username,
            email=user.email,
            role_id=user.role_id,
            role_name=user.role.name if user.role else None
        ))
    
    return UserListResponse(
        users=user_list,
        total=len(user_list)
    )


def get_user_by_id(session: Session, user_id: int) -> Optional[UserWithRole]:
    """
    Retrieve a specific user by their ID.
    
    Args:
        session: Database session
        user_id: The ID of the user to retrieve
    
    Returns:
        UserWithRole if found, None otherwise
    """
    user = session.get(User, user_id)
    
    if not user:
        return None
    
    return UserWithRole(
        id=user.id,
        username=user.username,
        email=user.email,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None
    )


def assign_role_to_user(
    session: Session, 
    user_id: int, 
    request: AssignRoleRequest
) -> UserWithRole:
    """
    Assign a new role to a user.
    
    This function updates a user's role, changing their permissions.
    Only Admins can perform this operation.
    
    RBAC Requirement:
        Permission: 'manage_roles' (Admin only)
    
    Use Cases:
        - Promoting an Applicant to Recruiter
        - Demoting a Recruiter to Applicant
        - Granting Admin privileges
    
    Args:
        session: Database session
        user_id: The ID of the user to update
        request: Contains the new role name
    
    Returns:
        UserWithRole: The updated user information
    
    Raises:
        ValueError: If user or role not found
    """
    # Find the user
    user = session.get(User, user_id)
    if not user:
        raise ValueError(f"User with ID {user_id} not found")
    
    # Find the new role
    role = session.exec(
        select(Role).where(Role.name == request.role_name)
    ).first()
    if not role:
        raise ValueError(f"Role '{request.role_name}' not found")
    
    # Update the user's role
    user.role_id = role.id
    
    # Commit the change
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return UserWithRole(
        id=user.id,
        username=user.username,
        email=user.email,
        role_id=user.role_id,
        role_name=role.name
    )


def get_all_roles(session: Session) -> List[Role]:
    """
    Retrieve all available roles.
    
    Useful for populating role selection dropdowns in the UI.
    
    Args:
        session: Database session
    
    Returns:
        List of Role objects with their permissions
    """
    return list(session.exec(select(Role)).all())


def update_user_profile(
    session: Session,
    user_id: int,
    request: UserUpdateRequest
) -> UserWithRole:
    """Update a user's profile information."""
    user = session.get(User, user_id)
    if not user:
        raise ValueError("User not found")
        
    if request.username is not None:
        user.username = request.username
    if request.email is not None:
        user.email = request.email
        
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return UserWithRole(
        id=user.id,
        username=user.username,
        email=user.email,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None
    )


def change_user_password(
    session: Session,
    user_id: int,
    request: PasswordChangeRequest
):
    """Change a user's password securely."""
    user = session.get(User, user_id)
    if not user:
        raise ValueError("User not found")
        
    if not verify_password(request.current_password, user.hashed_password):
        raise ValueError("Incorrect current password")
        
    user.hashed_password = hash_password(request.new_password)
    session.add(user)
    session.commit()
