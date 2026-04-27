"""
Report Schemas

Pydantic schemas for report generation API requests and responses.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReportRequest(BaseModel):
    """Schema for requesting a report generation."""
    report_type: str = Field(
        description="Type of report: 'pipeline', 'match_scores', or 'usage'"
    )
    format: str = Field(
        default="json",
        description="Output format: 'json', 'csv', 'xlsx', or 'pdf'"
    )
    job_id: Optional[int] = Field(
        default=None,
        description="Optional job ID filter"
    )
    date_from: Optional[datetime] = Field(
        default=None,
        description="Optional start date filter"
    )
    date_to: Optional[datetime] = Field(
        default=None,
        description="Optional end date filter"
    )


class ReportTypeInfo(BaseModel):
    """Describes an available report type."""
    id: str
    name: str
    description: str
    supported_formats: List[str]
    supports_job_filter: bool
    supports_date_filter: bool


class ReportMetadata(BaseModel):
    """Metadata about a generated report."""
    report_type: str
    generated_at: datetime
    total_rows: int
    filters: Dict[str, Any]


class ReportResponse(BaseModel):
    """JSON report response with data and metadata."""
    metadata: ReportMetadata
    columns: List[str]
    rows: List[Dict[str, Any]]
