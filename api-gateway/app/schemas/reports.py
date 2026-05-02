"""Schemas for report generation and export."""

from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    """Student risk levels."""
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    ON_TRACK = "ON_TRACK"
    ALL = "ALL"


class ExportFormat(str, Enum):
    """Supported export formats."""
    CSV = "csv"
    PDF = "pdf"
    EXCEL = "excel"


class StudentRiskReport(BaseModel):
    """Student risk report item."""
    student_number: str
    student_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    course_code: str
    risk_level: RiskLevel
    risk_probability: Optional[float] = None
    avg_score: Optional[float] = None
    status: Optional[str] = None
    prediction_date: Optional[datetime] = None


class CourseStudentSummary(BaseModel):
    """Summary of students in a course by risk level."""
    course_code: str
    total_students: int
    high_risk_count: int
    moderate_risk_count: int
    on_track_count: int
    unknown_count: int
    average_score: Optional[float] = None
    exported_at: datetime = Field(default_factory=datetime.utcnow)


class StudentPerformanceReport(BaseModel):
    """Detailed student performance report."""
    student_number: str
    student_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    course_code: str
    course_title: Optional[str] = None
    average_score: Optional[float] = None
    assignment_submissions: Optional[int] = None
    assessment_attempts: Optional[int] = None
    resource_access: Optional[int] = None
    login_frequency: Optional[int] = None
    risk_level: RiskLevel
    prediction_date: Optional[datetime] = None


class InterventionCaseReport(BaseModel):
    """Intervention case report item."""
    case_id: Optional[str] = None
    student_number: str
    course_code: Optional[str] = None
    risk_level: Optional[str] = None
    reason: Optional[str] = None
    status: str
    created_by_role: Optional[str] = None
    created_by_identifier: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReportGenerationRequest(BaseModel):
    """Request parameters for report generation."""
    report_type: str = Field(..., description="Type of report: at-risk-students, course-summary, performance, interventions")
    export_format: ExportFormat = Field(default=ExportFormat.CSV, description="Export format")
    risk_level: Optional[RiskLevel] = Field(default=None, description="Filter by risk level (for at-risk-students report)")
    course_code: Optional[str] = Field(default=None, description="Filter by course code")
    lecturer_number: Optional[str] = Field(default=None, description="Filter by lecturer (for lecturer or admin reports)")
    student_number: Optional[str] = Field(default=None, description="Filter by student number")
    start_date: Optional[datetime] = Field(default=None, description="Start date filter")
    end_date: Optional[datetime] = Field(default=None, description="End date filter")
    include_interventions: bool = Field(default=False, description="Include intervention history")


class ReportResponse(BaseModel):
    """Response after report generation."""
    filename: str
    total_records: int
    export_format: ExportFormat
    report_type: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    message: Optional[str] = None


class ReportMetadata(BaseModel):
    """Metadata about available reports."""
    report_id: str
    name: str
    description: str
    available_formats: list[ExportFormat]
    requires_parameters: list[str]
    roles_allowed: list[str]
