from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session
from typing import Optional

from database import get_session
from dependencies import check_permissions, get_current_user
from models.user import User
from models.deployment import DeploymentStatus
from schemas.deployment import DeploymentCreate, DeploymentUpdate, DeploymentResponse, DeploymentListResponse
from models.controllers.deployment_controller import deploy_candidate, get_deployments, update_deployment_status

router = APIRouter(
    prefix="/deployments",
    tags=["Deployments (ERP)"],
    responses={401: {"description": "Not authenticated"}}
)

@router.post("/", response_model=DeploymentResponse, status_code=status.HTTP_201_CREATED)
def create_deployment(
    request: DeploymentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    try:
        return deploy_candidate(session, current_user, request)
    except ValueError as e:
        # 403 Forbidden is good for business rule blockers like Missing Contracts
        if "Blocked" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deployment error: {str(e)}")

@router.get("/", response_model=DeploymentListResponse)
def list_deployments(
    status: Optional[DeploymentStatus] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    deps = get_deployments(session, status)
    return {"deployments": deps, "total": len(deps)}

@router.put("/{deployment_id}", response_model=DeploymentResponse)
def update_status(
    deployment_id: int,
    request: DeploymentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    try:
        return update_deployment_status(session, deployment_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
