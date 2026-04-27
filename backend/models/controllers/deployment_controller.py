from datetime import datetime
from typing import List, Dict
from sqlmodel import Session, select
from fastapi import HTTPException

from models.deployment import Deployment, DeploymentStatus
from models.application import Application, ApplicationStatus
from models.client import Client
from models.user import User
from models.job import JobRequisition
from models.document import Document
from schemas.deployment import DeploymentCreate, DeploymentUpdate, DeploymentResponse
from schemas.client import ClientResponse

def _build_deployment_response(deployment: Deployment) -> DeploymentResponse:
    # Hydrate relationships manually for the response if needed
    # But SQLModel lazy loading or joined loading might already fetch them
    # For safety, we access attributes that trigger loads
    return DeploymentResponse(
        id=deployment.id,
        application_id=deployment.application_id,
        candidate_id=deployment.candidate_id,
        job_id=deployment.job_id,
        client_id=deployment.client_id,
        start_date=deployment.start_date,
        end_date=deployment.end_date,
        status=deployment.status,
        notes=deployment.notes,
        candidate_name=deployment.candidate.username if deployment.candidate else "Unknown",
        job_title=deployment.job.title if deployment.job else "Unknown",
        client=ClientResponse.model_validate(deployment.client) if deployment.client else None
    )

def deploy_candidate(session: Session, current_user: User, request: DeploymentCreate) -> DeploymentResponse:
    """
    Deploy a candidate to a client.
    Validation Phase 1 Rule: Candidate MUST have a contract document.
    """
    app = session.get(Application, request.application_id)
    if not app:
        raise ValueError("Application not found")
        
    client = session.get(Client, request.client_id)
    if not client:
        raise ValueError("Client not found")
        
    # Phase 1 VALIDATION BRIDGE: Check for 'Contract' document
    docs = session.exec(
        select(Document).where(
            Document.user_id == app.candidate_id,
            Document.document_type.ilike("%contract%")
        )
    ).all()
    
    if not docs:
        raise ValueError("Deployment Blocked: This candidate does not have a Contract uploaded to their Digital 201 File Vault.")
        
    # Check if already deployed
    existing = session.exec(
        select(Deployment).where(
            Deployment.application_id == app.id,
            Deployment.status == DeploymentStatus.ACTIVE
        )
    ).first()
    
    if existing:
        raise ValueError("Candidate is already actively deployed.")
        
    # Create deployment
    deployment = Deployment(
        application_id=app.id,
        candidate_id=app.candidate_id,
        job_id=app.job_id,
        client_id=client.id,
        end_date=request.end_date,
        notes=request.notes
    )
    session.add(deployment)
    
    # Update application status
    app.status = ApplicationStatus.DEPLOYED
    session.add(app)
    
    session.commit()
    session.refresh(deployment)
    
    # Reload to get hydrated relationships
    deployment = session.get(Deployment, deployment.id)
    return _build_deployment_response(deployment)

def get_deployments(session: Session, status: DeploymentStatus = None) -> List[DeploymentResponse]:
    query = select(Deployment).order_by(Deployment.start_date.desc())
    if status:
        query = query.where(Deployment.status == status)
        
    deployments = session.exec(query).all()
    return [_build_deployment_response(d) for d in deployments]

def update_deployment_status(session: Session, deployment_id: int, request: DeploymentUpdate) -> DeploymentResponse:
    deployment = session.get(Deployment, deployment_id)
    if not deployment:
        raise ValueError("Deployment not found")
        
    if request.status:
        deployment.status = request.status
        # If it's completed or terminated, we might want to update the ApplicationStatus back to something? 
        # For ERP, we can just leave ApplicationStatus as DEPLOYED but Deployment as inactive.
        # Or mark ApplicationStatus as HIRED/AVAILABLE
        
    if request.end_date:
        deployment.end_date = request.end_date
    if request.notes is not None:
        deployment.notes = request.notes
        
    session.add(deployment)
    session.commit()
    session.refresh(deployment)
    return _build_deployment_response(deployment)
