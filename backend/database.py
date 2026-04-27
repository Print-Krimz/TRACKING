"""
Database Configuration Module

This module handles the PostgreSQL database connection and session management
using SQLModel (which combines SQLAlchemy ORM with Pydantic validation).

Architecture Decision:
- We use SQLModel for its seamless integration with FastAPI and Pydantic
- The session is managed via a generator function for proper cleanup
- Connection pooling is handled by SQLAlchemy under the hood
"""

import os
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine

# Load environment variables from .env file
# This allows us to keep sensitive data (like database credentials) out of code
load_dotenv()

# Get the database URL from environment variables
# Using an environment variable allows for different configs in dev/staging/prod
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/resume_db")

# Create the SQLAlchemy engine
# The engine is the core interface to the database, managing connection pooling
# echo=False disables SQL query logging (set to True for debugging)
engine = create_engine(DATABASE_URL, echo=False)


def create_db_and_tables() -> None:
    """
    Create all database tables defined by SQLModel models.
    
    This function should be called once at application startup.
    SQLModel.metadata.create_all() will:
    - Introspect all models that inherit from SQLModel
    - Generate the appropriate CREATE TABLE statements
    - Only create tables that don't already exist (safe to call multiple times)
    """
    SQLModel.metadata.create_all(engine)


def ensure_application_status_enum_values() -> None:
    """
    Ensure PostgreSQL enum `applicationstatus` includes all required values.

    SQLModel's create_all() does not alter existing enum types, so legacy
    databases created before new enum members were added must be migrated.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(
            text("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'DEPLOYED'")
        )
        connection.commit()


def ensure_deployment_contract_alert_schema() -> None:
    """
    Ensure deployment contract alert table and indexes exist.

    This helper keeps existing deployments intact while introducing
    a persisted alert history table in environments where tables already exist.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS deployment_contract_alert (
                    id SERIAL PRIMARY KEY,
                    deployment_id INTEGER NOT NULL,
                    contract_end_date TIMESTAMP NOT NULL,
                    stage_code VARCHAR(20) NOT NULL,
                    days_remaining INTEGER NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    email_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    email_error TEXT NULL,
                    CONSTRAINT uq_deployment_contract_alert_stage
                        UNIQUE (deployment_id, contract_end_date, stage_code),
                    CONSTRAINT fk_deployment_contract_alert_deployment
                        FOREIGN KEY (deployment_id) REFERENCES deployment (id)
                )
                """
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_dca_created_at "
                "ON deployment_contract_alert (created_at)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_dca_stage_code "
                "ON deployment_contract_alert (stage_code)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_dca_deployment_id "
                "ON deployment_contract_alert (deployment_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_dca_email_status "
                "ON deployment_contract_alert (email_status)"
            )
        )
        connection.commit()


def ensure_user_profile_fields() -> None:
    """
    Ensure candidate professional profile columns exist on `user` table.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS location VARCHAR(120)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS current_title VARCHAR(120)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS years_experience INTEGER"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(255)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS professional_summary VARCHAR(2000)"))
        connection.commit()


def get_session() -> Generator[Session, None, None]:
    """
    Dependency injection function for database sessions.
    
    This generator function:
    - Creates a new database session for each request
    - Yields the session to the route handler
    - Automatically closes the session when the request completes
    - Used as a FastAPI dependency via Depends(get_session)
    
    Usage in routes:
        @app.get("/items")
        def get_items(session: Session = Depends(get_session)):
            return session.exec(select(Item)).all()
    
    Yields:
        Session: A SQLModel/SQLAlchemy session for database operations
    """
    with Session(engine) as session:
        yield session
