from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List

from database import get_session
from dependencies import check_permissions, get_current_user
from models.user import User
from schemas.client import ClientCreate, ClientUpdate, ClientResponse
from models.controllers.client_controller import create_client, get_clients, update_client

router = APIRouter(
    prefix="/clients",
    tags=["Clients (ERP)"],
    responses={401: {"description": "Not authenticated"}}
)

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def add_client(
    request: ClientCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    try:
        return create_client(session, request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[ClientResponse])
def list_clients(
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    return get_clients(session)

@router.put("/{client_id}", response_model=ClientResponse)
def modify_client(
    client_id: int,
    request: ClientUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(check_permissions("manage_applications"))
):
    try:
        return update_client(session, client_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
