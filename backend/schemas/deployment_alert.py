from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from models.deployment_contract_alert import ContractAlertStage


class DeploymentContractAlertResponse(BaseModel):
    id: int
    deployment_id: int
    stage_code: ContractAlertStage
    days_remaining: int
    created_at: datetime
    type: str
    message: str
    link: str = "/deployments"

    class Config:
        from_attributes = True


class DeploymentContractAlertListResponse(BaseModel):
    alerts: List[DeploymentContractAlertResponse]
    total: int
    limit: int
    offset: int
    stage: Optional[ContractAlertStage] = None
    since: Optional[datetime] = None
