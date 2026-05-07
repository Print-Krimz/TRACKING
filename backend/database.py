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


def ensure_automation_schema() -> None:
    """
    Ensure automation support tables and audit log upgrades exist.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS automation_job (
                    id SERIAL PRIMARY KEY,
                    job_type VARCHAR(80) NOT NULL,
                    idempotency_key VARCHAR(120) NOT NULL,
                    actor_type VARCHAR(20) NOT NULL DEFAULT 'user',
                    actor_user_id INTEGER NULL,
                    payload_json TEXT NOT NULL,
                    result_json TEXT NULL,
                    error_message TEXT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'queued',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    max_attempts INTEGER NOT NULL DEFAULT 3,
                    latency_ms INTEGER NULL,
                    next_retry_at TIMESTAMP NULL,
                    started_at TIMESTAMP NULL,
                    finished_at TIMESTAMP NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_automation_job_idempotency UNIQUE (job_type, idempotency_key)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS report_schedule (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    report_type VARCHAR(50) NOT NULL,
                    format VARCHAR(20) NOT NULL DEFAULT 'json',
                    cadence VARCHAR(30) NOT NULL DEFAULT 'manual',
                    job_id INTEGER NULL,
                    date_from TIMESTAMP NULL,
                    date_to TIMESTAMP NULL,
                    delivery_channel VARCHAR(30) NOT NULL DEFAULT 'in_app',
                    recipient_email VARCHAR(255) NULL,
                    created_by_user_id INTEGER NULL,
                    config_json TEXT NOT NULL DEFAULT '{}',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    last_run_at TIMESTAMP NULL,
                    next_run_at TIMESTAMP NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        connection.execute(
            text(
                "ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_type VARCHAR(20) NOT NULL DEFAULT 'user'"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS before_state TEXT NULL"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS after_state TEXT NULL"
            )
        )
        connection.execute(
            text("ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL")
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_automation_job_status ON automation_job (status)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_automation_job_job_type ON automation_job (job_type)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_report_schedule_active ON report_schedule (is_active)"
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


def ensure_user_lifecycle_fields() -> None:
    """
    Ensure user lifecycle columns exist for archive/restore/delete workflows.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS status VARCHAR(20)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS archived_by_user_id INTEGER"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS archive_reason VARCHAR(500)"))
        connection.execute(text("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP"))
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'fk_user_archived_by_user'
                    ) THEN
                        ALTER TABLE "user"
                        ADD CONSTRAINT fk_user_archived_by_user
                        FOREIGN KEY (archived_by_user_id) REFERENCES "user"(id);
                    END IF;
                END
                $$;
                """
            )
        )
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_user_status ON \"user\" (status)")
        )
        connection.execute(
            text("UPDATE \"user\" SET status = 'active' WHERE status IS NULL OR status = ''")
        )
        connection.commit()


def ensure_talent_pool_fields() -> None:
    """
    Ensure talent pool cooldown metadata exists.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(
            text(
                "ALTER TABLE talent_pool_entry ADD COLUMN IF NOT EXISTS rescan_state_json TEXT NULL"
            )
        )
        connection.commit()


def ensure_document_metadata_fields() -> None:
    """
    Ensure document OCR suggestion columns exist.
    """
    if engine.url.get_backend_name() != "postgresql":
        return

    with engine.connect() as connection:
        connection.execute(
            text(
                "ALTER TABLE document ADD COLUMN IF NOT EXISTS document_type_candidate VARCHAR(100) NULL"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE document ADD COLUMN IF NOT EXISTS expiration_date_candidate TIMESTAMP NULL"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE document ADD COLUMN IF NOT EXISTS extraction_confidence DOUBLE PRECISION NULL"
            )
        )
        connection.execute(
            text(
                "ALTER TABLE document ADD COLUMN IF NOT EXISTS metadata_confirmed BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
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
