from fastapi import APIRouter, Depends
from sqlmodel import Session

from database import get_session
from dependencies import check_permissions
from models.user import User
from schemas.automation import AutomationFlagsResponse, AutomationMetricsResponse
from services.automation_flags import get_automation_flags
from services.automation_job_service import automation_metrics


router = APIRouter(
    prefix="/automation",
    tags=["Automation"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get("/flags", response_model=AutomationFlagsResponse)
def list_automation_flags(
    current_user: User = Depends(check_permissions("view_analytics")),
):
    return AutomationFlagsResponse(flags=get_automation_flags())


@router.get("/metrics", response_model=AutomationMetricsResponse)
def get_automation_metrics(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("view_analytics")),
):
    return AutomationMetricsResponse(**automation_metrics(session))
