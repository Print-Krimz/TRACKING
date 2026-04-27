"""
Routes Package

API route modules for the ATS Application.
"""

from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router, roles_router
from routes.resume_routes import router as resume_router
from routes.job_routes import router as job_router
from routes.application_routes import router as application_router
from routes.analytics_routes import router as analytics_router
from routes.matching_routes import router as matching_router
from routes.document_routes import router as document_router
from routes.client_routes import router as client_router
from routes.deployment_routes import router as deployment_router
from routes.admin_routes import router as admin_router

__all__ = [
    "auth_router", "user_router", "roles_router", 
    "resume_router", "job_router", "application_router",
    "analytics_router", "matching_router", "document_router",
    "client_router", "deployment_router", "admin_router"
]


