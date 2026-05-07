"""
RBAC Resume Application - Main Entry Point

This is the FastAPI application entry point that:
1. Configures the application with CORS middleware
2. Registers all API routers
3. Creates database tables on startup
4. Seeds default roles and permissions

Architecture:
- Clean MVC pattern with separation of concerns
- Controllers handle business logic
- Routes handle HTTP request/response
- Models define database schema
- Schemas define API contracts

To run the application:
    uvicorn main:app --reload

API Documentation:
    - Swagger UI: http://localhost:8000/docs
    - ReDoc: http://localhost:8000/redoc
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from database import (
    create_db_and_tables,
    ensure_application_status_enum_values,
    ensure_automation_schema,
    ensure_document_metadata_fields,
    ensure_deployment_contract_alert_schema,
    ensure_talent_pool_fields,
    ensure_user_lifecycle_fields,
    ensure_user_profile_fields,
    engine,
)
from routes import (
    auth_router, user_router, roles_router, resume_router, job_router, 
    application_router, analytics_router, matching_router, document_router,
    client_router, deployment_router, admin_router, talent_pool_router,
    interview_router, messaging_router, notification_router
)
from routes.automation_routes import router as automation_router
from models.permission import Permission, RolePermissionLink
from models.role import Role
from models.job import JobRequisition, JobStatus
from models.client import Client
from models.deployment import Deployment
from models.deployment_contract_alert import DeploymentContractAlert
from models.application_message import ApplicationMessage, ApplicationMessageThread
from models.application_interview import ApplicationInterview
from models.notification import AppNotification
from models.audit_log import AuditLog
from models.automation_job import AutomationJob
from models.report_schedule import ReportSchedule
from services.deployment_contract_alert_service import run_contract_expiration_alert_job
from services.automation_job_service import process_pending_automation_jobs
from services.report_schedule_service import enqueue_due_report_schedules
import services.automation_handlers  # noqa: F401 - registers automation handlers


async def _contract_alert_scheduler() -> None:
    """
    Run contract alert checks daily at 00:15 UTC.
    """
    while True:
        now_utc = datetime.now(timezone.utc)
        next_run = now_utc.replace(hour=0, minute=15, second=0, microsecond=0)
        if next_run <= now_utc:
            next_run = next_run + timedelta(days=1)

        wait_seconds = (next_run - now_utc).total_seconds()
        await asyncio.sleep(max(wait_seconds, 1))

        try:
            result = run_contract_expiration_alert_job()
            if result.get("ran"):
                print(
                    "Contract alert job completed: "
                    f"created_alerts={result.get('created_alerts', 0)} "
                    f"auto_terminated={result.get('auto_terminated', 0)}"
                )
            else:
                print(
                    "Contract alert job skipped: "
                    f"{result.get('reason', 'unknown_reason')}"
                )
        except Exception as exc:
            print(f"Contract alert job failed: {exc}")


async def _automation_job_scheduler() -> None:
    """
    Drain queued automation jobs and retries.
    """
    while True:
        await asyncio.sleep(30)
        try:
            with Session(engine) as session:
                processed = process_pending_automation_jobs(session, limit=10)
            if processed:
                print(f"Processed {len(processed)} automation job(s)")
        except Exception as exc:
            print(f"Automation job processor failed: {exc}")


async def _report_schedule_scheduler() -> None:
    """
    Queue and execute due scheduled reports.
    """
    while True:
        try:
            with Session(engine) as session:
                jobs = enqueue_due_report_schedules(session, limit=10)
            if jobs:
                print(f"Queued {len(jobs)} scheduled report job(s)")
        except Exception as exc:
            print(f"Scheduled report processor failed: {exc}")
        await asyncio.sleep(60)


def seed_roles_and_permissions(session: Session) -> None:
    """
    Seed the database with default roles and permissions.
    
    This function creates the initial RBAC structure:
    
    Permissions:
        Resume:
        - view_own_resume: Candidates can view their own resumes
        - view_all_resumes: Recruiters/Admins can view all resumes
        - submit_resume: Candidates can submit resumes
        - analyze_resume: Recruiters/Admins can trigger AI analysis
        
        Job Management:
        - manage_jobs: Create/edit/delete job requisitions
        - view_jobs: View job listings
        
        Applications:
        - apply_to_job: Candidates can apply to jobs
        - view_own_applications: Candidates see their applications
        - view_all_applications: Recruiters see all applications
        - manage_applications: Update application status
        
        Interviews:
        - schedule_interview: Schedule interviews
        - conduct_interview: Access interview features
        - view_assigned_candidates: Interviewers see assigned candidates
        
        Admin:
        - manage_users: Admins can manage user accounts
        - manage_roles: Admins can assign roles to users
        - view_analytics: Access analytics dashboard
    
    Roles:
        - Candidate: submit_resume, view_own_resume, view_jobs, apply_to_job, view_own_applications
        - Interviewer: view_assigned_candidates, conduct_interview
        - Recruiter: view_all_resumes, analyze_resume, manage_jobs, view_jobs, 
                    view_all_applications, manage_applications, schedule_interview, view_analytics
        - Control Panel Admin: All permissions
        - Admin: All permissions
    
    The function is idempotent - it only creates entries that don't exist.
    
    Args:
        session: Database session
    """
    # Define all permissions
    permissions_data = [
        # Resume permissions
        {"name": "view_own_resume", "description": "View own submitted resumes"},
        {"name": "view_all_resumes", "description": "View all resumes in the system"},
        {"name": "submit_resume", "description": "Submit a new resume"},
        {"name": "analyze_resume", "description": "Trigger AI analysis on resumes"},
        # Job management permissions
        {"name": "manage_jobs", "description": "Create, edit, and delete job requisitions"},
        {"name": "view_jobs", "description": "View job listings"},
        # Application permissions
        {"name": "apply_to_job", "description": "Apply to job postings"},
        {"name": "view_own_applications", "description": "View own job applications"},
        {"name": "view_all_applications", "description": "View all job applications"},
        {"name": "manage_applications", "description": "Update application status"},
        # Interview permissions
        {"name": "schedule_interview", "description": "Schedule interviews with candidates"},
        {"name": "conduct_interview", "description": "Access interview features"},
        {"name": "view_assigned_candidates", "description": "View candidates assigned for interview"},
        # Admin permissions
        {"name": "manage_users", "description": "Manage user accounts"},
        {"name": "manage_roles", "description": "Assign roles to users"},
        {"name": "view_analytics", "description": "Access analytics and reports"},
    ]
    
    # Create permissions if they don't exist
    permissions = {}
    for perm_data in permissions_data:
        existing = session.exec(
            select(Permission).where(Permission.name == perm_data["name"])
        ).first()
        
        if not existing:
            perm = Permission(**perm_data)
            session.add(perm)
            session.commit()
            session.refresh(perm)
            permissions[perm_data["name"]] = perm
        else:
            permissions[perm_data["name"]] = existing
    
    # Define roles with their permissions
    roles_data = {
        "Candidate": [
            "submit_resume", "view_own_resume", "view_jobs", 
            "apply_to_job", "view_own_applications"
        ],
        "Applicant": [  # Legacy role - same as Candidate
            "submit_resume", "view_own_resume", "view_jobs", 
            "apply_to_job", "view_own_applications"
        ],
        "Interviewer": [
            "view_assigned_candidates", "conduct_interview"
        ],
        "Recruiter": [
            "view_all_resumes", "analyze_resume", "manage_jobs", "view_jobs",
            "view_all_applications", "manage_applications", "schedule_interview", 
            "view_analytics"
        ],
        "Control Panel Admin": list(permissions.keys()),  # Elevated admin role
        "Admin": list(permissions.keys()),  # All permissions
    }
    
    # Create roles if they don't exist and assign permissions
    for role_name, perm_names in roles_data.items():
        existing_role = session.exec(
            select(Role).where(Role.name == role_name)
        ).first()
        
        if not existing_role:
            role = Role(name=role_name)
            session.add(role)
            session.commit()
            session.refresh(role)
            
            # Assign permissions to role
            for perm_name in perm_names:
                if perm_name in permissions:
                    link = RolePermissionLink(
                        role_id=role.id,
                        permission_id=permissions[perm_name].id
                    )
                    session.add(link)
            
            session.commit()
        else:
            # Check and add new permissions to existing roles
            existing_perm_ids = {p.id for p in existing_role.permissions}
            for perm_name in perm_names:
                if perm_name in permissions:
                    perm = permissions[perm_name]
                    if perm.id not in existing_perm_ids:
                        link = RolePermissionLink(
                            role_id=existing_role.id,
                            permission_id=perm.id
                        )
                        session.add(link)
            session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    This async context manager runs:
    - On startup: Create tables and seed data
    - On shutdown: Cleanup (if needed)
    
    Using the lifespan pattern instead of on_event decorators
    as recommended by FastAPI for newer applications.
    """
    # Startup: Create database tables
    print("Creating database tables...")
    create_db_and_tables()
    ensure_application_status_enum_values()
    ensure_automation_schema()
    
    # Ensure deployment contract alert schema upgrades are applied
    ensure_deployment_contract_alert_schema()
    ensure_talent_pool_fields()
    ensure_document_metadata_fields()
    ensure_user_profile_fields()
    ensure_user_lifecycle_fields()

    # Seed roles and permissions
    print("Seeding roles and permissions...")
    with Session(engine) as session:
        seed_roles_and_permissions(session)
    
    # Migrate any DRAFT jobs to OPEN (one-time fix for pre-existing data)
    with Session(engine) as session:
        draft_jobs = session.exec(
            select(JobRequisition).where(JobRequisition.status == JobStatus.DRAFT)
        ).all()
        if draft_jobs:
            for job in draft_jobs:
                job.status = JobStatus.OPEN
            session.commit()
            print(f"Migrated {len(draft_jobs)} DRAFT jobs to OPEN status")
    
    # Start scheduler and run a startup pass to avoid missing alerts.
    scheduler_task = asyncio.create_task(_contract_alert_scheduler())
    automation_scheduler_task = asyncio.create_task(_automation_job_scheduler())
    report_scheduler_task = asyncio.create_task(_report_schedule_scheduler())
    try:
        startup_result = run_contract_expiration_alert_job()
        if startup_result.get("ran"):
            print(
                "Startup contract alert run: "
                f"created_alerts={startup_result.get('created_alerts', 0)} "
                f"auto_terminated={startup_result.get('auto_terminated', 0)}"
            )
    except Exception as exc:
        print(f"Startup contract alert run failed: {exc}")

    print("Application startup complete!")

    yield  # Application runs here

    # Shutdown: Cleanup if needed
    scheduler_task.cancel()
    automation_scheduler_task.cancel()
    report_scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    try:
        await automation_scheduler_task
    except asyncio.CancelledError:
        pass
    try:
        await report_scheduler_task
    except asyncio.CancelledError:
        pass
    print("Shutting down application...")


# Create the FastAPI application instance
app = FastAPI(
    title="RBAC Resume Application",
    description="""
    A Role-Based Access Control system for resume analysis.
    
    ## Features
    
    * **User Authentication** - JWT-based login and registration
    * **Role-Based Access** - Admin, Recruiter, and Applicant roles
    * **Resume Management** - Submit and view resumes
    * **AI Analysis** - Analyze resumes using Google Gemini
    
    ## Roles
    
    | Role | Permissions |
    |------|-------------|
    | **Admin** | Full access - manage users, roles, and all resumes |
    | **Recruiter** | View all resumes, trigger AI analysis |
    | **Applicant** | Submit and view own resumes |
    
    ## Authentication
    
    1. Register at `/auth/register`
    2. Login at `/auth/login` to get JWT token
    3. Include token in requests: `Authorization: Bearer <token>`
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


# Configure CORS middleware
# This allows the React frontend to make requests to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative React port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)


# Register API routers
# Each router handles a specific domain of the application
app.include_router(auth_router)           # /auth/* routes
app.include_router(user_router)           # /users/* routes
app.include_router(roles_router)          # /roles/* routes
app.include_router(resume_router)         # /resumes/* routes
app.include_router(job_router)            # /jobs/* routes
app.include_router(application_router)    # /applications/* routes
app.include_router(analytics_router)      # /analytics/* routes
app.include_router(matching_router)       # /matching/* routes
app.include_router(document_router)       # /documents/* routes
app.include_router(client_router)         # /clients/* routes
app.include_router(deployment_router)     # /deployments/* routes
app.include_router(admin_router)          # /admin/* routes
app.include_router(talent_pool_router)    # /talent-pool/* routes
app.include_router(interview_router)      # /interviews/* routes
app.include_router(messaging_router)      # /messages/* routes
app.include_router(notification_router)   # /notifications/* routes
app.include_router(automation_router)     # /automation/* routes


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API health check.
    
    Returns basic API information and links to documentation.
    """
    return {
        "message": "Welcome to the RBAC Resume Application API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["Root"])
async def health_check():
    """
    Health check endpoint for monitoring.
    
    Returns the current status of the API and database connection.
    """
    try:
        # Quick database connection check
        with Session(engine) as session:
            session.exec(select(Role)).first()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "database": db_status
    }


# Entry point for running with Python directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
