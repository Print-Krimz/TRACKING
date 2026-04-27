from typing import List
from sqlmodel import Session, select
from models.client import Client
from schemas.client import ClientCreate, ClientUpdate

def create_client(session: Session, request: ClientCreate) -> Client:
    client = Client(**request.dict())
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

def get_clients(session: Session) -> List[Client]:
    return session.exec(select(Client).order_by(Client.company_name)).all()

def update_client(session: Session, client_id: int, request: ClientUpdate) -> Client:
    client = session.get(Client, client_id)
    if not client:
        raise ValueError("Client not found")
        
    for k, v in request.dict(exclude_unset=True).items():
        setattr(client, k, v)
        
    session.add(client)
    session.commit()
    session.refresh(client)
    return client
