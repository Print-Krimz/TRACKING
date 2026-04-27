from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class ContractAlertStage(str, Enum):
    D30 = "D30"
    D14 = "D14"
    D7 = "D7"
    D1 = "D1"
    EXPIRED = "EXPIRED"


class ContractAlertEmailStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class DeploymentContractAlert(SQLModel, table=True):
    __tablename__ = "deployment_contract_alert"
    __table_args__ = (
        UniqueConstraint(
            "deployment_id",
            "contract_end_date",
            "stage_code",
            name="uq_deployment_contract_alert_stage",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    deployment_id: int = Field(foreign_key="deployment.id", index=True)
    contract_end_date: datetime = Field(index=True)
    stage_code: ContractAlertStage = Field(index=True)
    days_remaining: int
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    email_status: ContractAlertEmailStatus = Field(
        default=ContractAlertEmailStatus.PENDING, index=True
    )
    email_error: Optional[str] = Field(default=None)
