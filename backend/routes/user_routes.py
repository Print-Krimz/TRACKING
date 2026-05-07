"""
User Routes

API endpoints for user management operations.
These routes are primarily for Admin users to manage the system.

Protected Routes (authentication required):
- GET /users - List all users (Admin only)
- GET /users/{user_id} - Get specific user (Admin only)
- PUT /users/{user_id}/role - Assign role to user (Admin only)
- GET /roles - List all roles (authenticated users)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user, check_permissions
from models.user import User
from schemas.user import (
    ArchiveUserRequest,
    AssignRoleRequest,
    PasswordChangeRequest,
    RestoreUserRequest,
    RoleResponse,
    UserListResponse,
    UserUpdateRequest,
    UserWithRole,
)
from models.controllers.user_controller import (
    archive_user,
    delete_user,
    get_all_users,
    get_user_by_id,
    assign_role_to_user,
    get_all_roles,
    restore_user,
    update_user_profile,
    change_user_password
)

# Create the router with prefix and tags
router = APIRouter(
    prefix="/users",
    tags=["Users"],
    responses={
        401: {"description": "Not authenticated"},
        403: {"description": "Permission denied"}
    }
)


@router.get(
    "/",
    response_model=UserListResponse,
    summary="List all users",
    description="""
    Retrieve a list of all users in the system.
    
    **Required Permission:** `manage_users` (Admin only)
    
    Returns all users with their role information.
    """
)
def list_users(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    include_archived: bool = Query(default=True),
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users"))
):
    """
    List all users endpoint.
    
    RBAC: Only users with 'manage_users' permission (Admins) can access.
    The check_permissions dependency enforces this automatically.
    
    Args:
        session: Database session
        current_user: Authenticated user with manage_users permission
    
    Returns:
        UserListResponse: List of all users with role info
    """
    return get_all_users(
        session=session,
        status=status_filter,
        include_archived=include_archived,
    )


@router.get(
    "/me",
    response_model=UserWithRole,
    summary="Get current user",
    description="""
    Retrieve the currently authenticated user's information.
    
    **Required:** Authentication
    
    Returns the user's profile including their role.
    """
)
def get_current_user_info(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's info.
    
    Any authenticated user can access their own information.
    
    Args:
        current_user: The authenticated user
    
    Returns:
        UserWithRole: Current user's information
    """
    response = get_user_by_id(session, current_user.id)
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return response


@router.put(
    "/me",
    response_model=UserWithRole,
    summary="Update current user profile",
    description="Update the authenticated user's profile information."
)
def update_profile(
    request: UserUpdateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Update user profile."""
    try:
        return update_user_profile(session, current_user.id, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put(
    "/me/password",
    summary="Change password",
    description="Securely change the authenticated user's password."
)
def change_password(
    request: PasswordChangeRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Change user password."""
    try:
        change_user_password(session, current_user.id, request)
        return {"message": "Password updated successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get(
    "/{user_id}",
    response_model=UserWithRole,
    summary="Get user by ID",
    description="""
    Retrieve a specific user's information.
    
    **Required Permission:** `manage_users` (Admin only)
    """
)
def get_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users"))
):
    """
    Get user by ID endpoint.
    
    RBAC: Only admins can view other users' information.
    
    Args:
        user_id: ID of the user to retrieve
        session: Database session
        current_user: Authenticated admin user
    
    Returns:
        UserWithRole: The requested user's information
    
    Raises:
        HTTPException 404: If user not found
    """
    user = get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    return user


@router.put(
    "/{user_id}/role",
    response_model=UserWithRole,
    summary="Assign role to user",
    description="""
    Update a user's role.
    
    **Required Permission:** `manage_roles` (Admin only)
    
    This changes the user's access level in the system.
    Available roles: Admin, Recruiter, Applicant
    """
)
def update_user_role(
    user_id: int,
    request: AssignRoleRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_roles"))
):
    """
    Assign role to user endpoint.
    
    RBAC: Only users with 'manage_roles' permission (Admins) can assign roles.
    
    Args:
        user_id: ID of the user to update
        request: New role to assign
        session: Database session
        current_user: Authenticated admin user
    
    Returns:
        UserWithRole: Updated user information
    
    Raises:
        HTTPException 400: If user or role not found
    """
    try:
        return assign_role_to_user(session, user_id, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch(
    "/{user_id}/archive",
    response_model=UserWithRole,
    summary="Archive user",
    description="Archive a user account and revoke all module access."
)
def archive_user_account(
    user_id: int,
    request: ArchiveUserRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users")),
):
    try:
        return archive_user(
            session=session,
            target_user_id=user_id,
            actor_user=current_user,
            request=request,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.patch(
    "/{user_id}/restore",
    response_model=UserWithRole,
    summary="Restore archived user",
    description="Restore an archived user account to active status."
)
def restore_user_account(
    user_id: int,
    request: RestoreUserRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users")),
):
    try:
        return restore_user(
            session=session,
            target_user_id=user_id,
            actor_user=current_user,
            request=request,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete(
    "/{user_id}",
    summary="Delete user permanently",
    description="Permanently delete user when no dependent records exist."
)
def delete_user_account(
    user_id: int,
    confirm: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_users")),
):
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hard delete requires confirm=true.",
        )

    try:
        delete_user(
            session=session,
            target_user_id=user_id,
            actor_user=current_user,
        )
        return {"message": "User deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


# Roles endpoint - for reference when assigning roles
roles_router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)


@roles_router.get(
    "/",
    response_model=list[RoleResponse],
    summary="List all roles",
    description="""
    Retrieve a list of all available roles.
    
    **Required:** Authentication
    
    Useful for populating role selection dropdowns.
    """
)
def list_roles(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    List all roles endpoint.
    
    Any authenticated user can view available roles.
    
    Args:
        session: Database session
        current_user: Any authenticated user
    
    Returns:
        List of RoleResponse: All available roles with permissions
    """
    roles = get_all_roles(session)
    return [
        RoleResponse(
            id=role.id,
            name=role.name,
            permissions=[
                {"id": p.id, "name": p.name, "description": p.description}
                for p in role.permissions
            ]
        )
        for role in roles
    ]
