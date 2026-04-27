"""
Models Package

This package contains all SQLModel ORM models for the ATS Application.
Importing from this package provides access to all model classes.

Models:
- Permission: Defines granular permissions (e.g., 'view_resume', 'analyze_resume')
- Role: User roles with associated permissions (Admin, Recruiter, Candidate, Interviewer)
- User: Application users with authentication credentials and role assignment
- Resume: Resume documents with AI analysis results
- JobRequisition: Job postings with criteria for matching
- JobCriteria: Skills/qualifications required for jobs
- JobKeyword: AI-extracted keywords from job descriptions
- Application: Candidate applications linking users to jobs

The models follow a hierarchical RBAC structure:
    Permission <--many-to-many--> Role <--one-to-many--> User
                                                              |
                                              +---------------+---------------+
                                              v               v               v
                                          Resume      Application      JobRequisition
"""

from models.permission import Permission, RolePermissionLink
from models.role import Role
from models.user import User
from models.resume import Resume
from models.job import JobRequisition, JobCriteria, JobKeyword, JobStatus
from models.application import Application, ApplicationStatus
from models.talent_pool import TalentPoolEntry, TalentPoolStatus

# Export all models for easy importing
__all__ = [
    "Permission", "RolePermissionLink", "Role", "User", "Resume",
    "JobRequisition", "JobCriteria", "JobKeyword", "JobStatus",
    "Application", "ApplicationStatus", "TalentPoolEntry", "TalentPoolStatus"
]
