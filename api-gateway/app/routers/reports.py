"""Report generation and export endpoints."""

import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.core.auth import get_current_session
from app.core.db import get_connection
from app.core.session import SessionContext
from app.services import report_export_service


router = APIRouter(
    prefix="/reports",
    tags=["Reports / Export"],
)


def _timestamp():
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _authorize_lecturer_export(session: SessionContext, lecturer_number: str | None):
    """Authorize lecturer to export their own reports or allow admin/advisor."""
    role = str(session.role).upper()
    user_id = str(session.userId)

    if role in ("ADMIN", "ADVISOR"):
        return

    if role == "LECTURER":
        if lecturer_number is None:
            return

        if user_id == str(lecturer_number):
            return

    raise HTTPException(
        status_code=403,
        detail=(
            f"Access denied for this lecturer report export. "
            f"Current role={role}, current user={user_id}, "
            f"requested lecturer={lecturer_number}"
        ),
    )


def _authorize_advisor_export(session: SessionContext):
    """Authorize advisor or admin to generate reports."""
    role = str(session.role).upper()

    if role in ("ADMIN", "ADVISOR"):
        return

    raise HTTPException(
        status_code=403,
        detail=f"Access denied. Advisor reports require ADVISOR or ADMIN role. Current role={role}",
    )


def _authorize_admin_export(session: SessionContext):
    """Authorize admin only to generate admin reports."""
    role = str(session.role).upper()

    if role == "ADMIN":
        return

    raise HTTPException(
        status_code=403,
        detail=f"Access denied. Admin reports require ADMIN role. Current role={role}",
    )


def _get_file_extension(export_format: str) -> str:
    """Get file extension for export format."""
    format_extensions = {
        "csv": ".csv",
        "pdf": ".pdf",
        "excel": ".xlsx",
    }
    return format_extensions.get(export_format.lower(), ".csv")


def _get_media_type(export_format: str) -> str:
    """Get media type for export format."""
    media_types = {
        "csv": "text/csv",
        "pdf": "application/pdf",
        "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    return media_types.get(export_format.lower(), "text/csv")


def _csv_response(filename: str, rows: list[dict], columns: list[str]):
    """Generate CSV response."""
    output = io.StringIO()

    if rows:
        discovered_columns = []
        for row in rows:
            for key in row.keys():
                if key not in discovered_columns:
                    discovered_columns.append(key)
        columns = discovered_columns

    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()

    for row in rows:
        writer.writerow(row)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _excel_response(filename: str, rows: list[dict], columns: list[str]):
    """Generate Excel response."""
    excel_bytes = report_export_service.make_excel(rows, columns)
    return StreamingResponse(
        iter([excel_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _pdf_response(filename: str, rows: list[dict], columns: list[str], title: str = "Report"):
    """Generate PDF response."""
    pdf_bytes = report_export_service.make_pdf(rows, columns, title)
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _get_response_for_format(export_format: str, filename: str, rows: list[dict], columns: list[str], title: str = "Report"):
    """Route to correct response format handler."""
    format_lower = export_format.lower()
    
    if format_lower == "excel":
        return _excel_response(filename, rows, columns)
    elif format_lower == "pdf":
        return _pdf_response(filename, rows, columns, title)
    else:  # Default to CSV
        return _csv_response(filename, rows, columns)


@router.get("/health")
def reports_health():
    """Health check endpoint for reports module."""
    return {
        "module": "Reports / Export",
        "status": "ONLINE",
        "available_endpoints": {
            "lecturer_at_risk": "/reports/lecturer/at-risk-students",
            "lecturer_moderate": "/reports/lecturer/moderate-students",
            "lecturer_on_track": "/reports/lecturer/on-track-students",
            "lecturer_all": "/reports/lecturer/all-students",
            "lecturer_course_summary": "/reports/lecturer/course-summary",
            "advisor_overview": "/reports/advisor/student-overview",
            "admin_institution": "/reports/admin/institution-summary",
            "admin_course_details": "/reports/admin/course-details",
        },
        "supported_formats": ["csv", "excel", "pdf"],
    }


# ==================== LECTURER ENDPOINTS ====================

@router.get("/lecturer/at-risk-students")
@router.get("/lecturer/at-risk-students.csv")
@router.get("/lecturer/at-risk-students.pdf")
@router.get("/lecturer/at-risk-students.xlsx")
def export_lecturer_at_risk_students(
    lecturer_number: str = Query(..., description="Lecturer number"),
    course_code: Optional[str] = Query(None, description="Filter by course code"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export students at HIGH risk for a lecturer."""
    _authorize_lecturer_export(session, lecturer_number)

    columns, rows = report_export_service.export_students_by_risk_level(
        risk_level="HIGH",
        course_code=course_code,
        lecturer_number=lecturer_number,
    )

    filename = f"lecturer_{lecturer_number}_at_risk_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "At-Risk Students Report")


@router.get("/lecturer/moderate-students")
@router.get("/lecturer/moderate-students.csv")
@router.get("/lecturer/moderate-students.pdf")
@router.get("/lecturer/moderate-students.xlsx")
def export_lecturer_moderate_students(
    lecturer_number: str = Query(..., description="Lecturer number"),
    course_code: Optional[str] = Query(None, description="Filter by course code"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export students at MODERATE risk for a lecturer."""
    _authorize_lecturer_export(session, lecturer_number)

    columns, rows = report_export_service.export_students_by_risk_level(
        risk_level="MODERATE",
        course_code=course_code,
        lecturer_number=lecturer_number,
    )

    filename = f"lecturer_{lecturer_number}_moderate_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "Moderate-Risk Students Report")


@router.get("/lecturer/on-track-students")
@router.get("/lecturer/on-track-students.csv")
@router.get("/lecturer/on-track-students.pdf")
@router.get("/lecturer/on-track-students.xlsx")
def export_lecturer_on_track_students(
    lecturer_number: str = Query(..., description="Lecturer number"),
    course_code: Optional[str] = Query(None, description="Filter by course code"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export students ON TRACK for a lecturer."""
    _authorize_lecturer_export(session, lecturer_number)

    columns, rows = report_export_service.export_students_by_risk_level(
        risk_level="ON_TRACK",
        course_code=course_code,
        lecturer_number=lecturer_number,
    )

    filename = f"lecturer_{lecturer_number}_on_track_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "On-Track Students Report")


@router.get("/lecturer/all-students")
@router.get("/lecturer/all-students.csv")
@router.get("/lecturer/all-students.pdf")
@router.get("/lecturer/all-students.xlsx")
def export_lecturer_all_students(
    lecturer_number: str = Query(..., description="Lecturer number"),
    course_code: Optional[str] = Query(None, description="Filter by course code"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export all students with their risk status for a lecturer."""
    _authorize_lecturer_export(session, lecturer_number)

    conn = get_connection()
    cur = conn.cursor()

    try:
        filters = ["lca.lecturer_number = %s"]
        values = [str(lecturer_number)]

        if course_code:
            filters.append("p.course_code = %s")
            values.append(str(course_code))

        where_sql = " AND ".join(filters)

        cur.execute(
            f"""
            WITH latest_prediction_run AS (
                SELECT run_id
                FROM predictive.model_run
                WHERE status = 'SUCCESS'
                ORDER BY finished_at DESC NULLS LAST, started_at DESC
                LIMIT 1
            )
            SELECT DISTINCT
                lca.lecturer_number,
                p.course_code,
                p.student_number,
                sm.first_name,
                sm.last_name,
                sm.email,
                p.risk_probability,
                p.predicted_risk_label,
                p.predicted_at_risk,
                p.generated_at AS prediction_created_at
            FROM latest_prediction_run lpr
            JOIN predictive.student_risk_prediction p
                ON p.run_id = lpr.run_id
            JOIN sakai_raw.lecturer_course_allocation lca
                ON lca.course_code = p.course_code
            LEFT JOIN sakai_raw.student_memberships sm
                ON sm.student_number = p.student_number
                AND sm.site_id LIKE p.course_code || '_%'
            WHERE {where_sql}
            ORDER BY
                p.course_code,
                CASE p.predicted_risk_label
                    WHEN 'HIGH' THEN 1
                    WHEN 'MODERATE' THEN 2
                    ELSE 3
                END,
                p.risk_probability DESC NULLS LAST,
                p.student_number;
            """,
            values,
        )

        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in rows]

        filename = f"lecturer_{lecturer_number}_all_students_{_timestamp()}{_get_file_extension(format)}"
        return _get_response_for_format(format, filename, rows, columns, "All Students Report")

    finally:
        cur.close()
        conn.close()


@router.get("/lecturer/course-summary")
@router.get("/lecturer/course-summary.csv")
@router.get("/lecturer/course-summary.pdf")
@router.get("/lecturer/course-summary.xlsx")
def export_lecturer_course_summary(
    lecturer_number: str = Query(..., description="Lecturer number"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export course summary report for a lecturer."""
    _authorize_lecturer_export(session, lecturer_number)

    columns, rows = report_export_service.export_course_summary(
        lecturer_number=lecturer_number,
    )

    filename = f"lecturer_{lecturer_number}_course_summary_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "Course Summary Report")


# ==================== ADVISOR ENDPOINTS ====================

@router.get("/advisor/student-overview")
@router.get("/advisor/student-overview.csv")
@router.get("/advisor/student-overview.pdf")
@router.get("/advisor/student-overview.xlsx")
def export_advisor_student_overview(
    risk_level: Optional[str] = Query(None, description="Filter by risk level: HIGH, MODERATE, ON_TRACK"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export student overview for advisors (all courses)."""
    _authorize_advisor_export(session)

    columns, rows = report_export_service.export_advisor_student_overview(
        risk_level=risk_level,
    )

    risk_suffix = f"_{risk_level}" if risk_level else "_all"
    filename = f"advisor_students{risk_suffix}_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "Advisor Student Overview")


@router.get("/advisor/at-risk-summary")
@router.get("/advisor/at-risk-summary.csv")
@router.get("/advisor/at-risk-summary.pdf")
@router.get("/advisor/at-risk-summary.xlsx")
def export_advisor_at_risk_summary(
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export summary of at-risk students for advisors."""
    _authorize_advisor_export(session)

    columns, rows = report_export_service.export_course_summary()

    filename = f"advisor_at_risk_summary_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "At-Risk Summary Report")


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/institution-summary")
@router.get("/admin/institution-summary.csv")
@router.get("/admin/institution-summary.pdf")
@router.get("/admin/institution-summary.xlsx")
def export_admin_institution_summary(
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export institutional summary report for system administrators."""
    _authorize_admin_export(session)

    columns, rows = report_export_service.export_admin_institution_summary()

    filename = f"admin_institution_summary_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "Institution Summary Report")


@router.get("/admin/course-details")
@router.get("/admin/course-details.csv")
@router.get("/admin/course-details.pdf")
@router.get("/admin/course-details.xlsx")
def export_admin_course_details(
    course_code: Optional[str] = Query(None, description="Filter by specific course code"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export detailed course information for all courses (admin only)."""
    _authorize_admin_export(session)

    columns, rows = report_export_service.export_course_summary()

    if course_code:
        rows = [r for r in rows if r.get("course_code") == course_code]

    filename = f"admin_course_details_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "Course Details Report")


@router.get("/admin/interventions")
@router.get("/admin/interventions.csv")
@router.get("/admin/interventions.pdf")
@router.get("/admin/interventions.xlsx")
def export_admin_interventions(
    course_code: Optional[str] = Query(None, description="Filter by course code"),
    status: Optional[str] = Query(None, description="Filter by status"),
    format: str = Query("csv", description="Export format: csv, pdf, excel"),
    session: SessionContext = Depends(get_current_session),
):
    """Export intervention cases for system administrators."""
    _authorize_admin_export(session)

    columns, rows = report_export_service.export_interventions(
        course_code=course_code,
        status=status,
    )

    filename = f"admin_interventions_{_timestamp()}{_get_file_extension(format)}"
    return _get_response_for_format(format, filename, rows, columns, "Interventions Report")


# ==================== LEGACY/GENERIC ENDPOINTS ====================

@router.get("/export")
@router.get("/export.csv")
@router.get("/lecturer/export")
@router.get("/lecturer/export.csv")
def export_lecturer_report_legacy(
    lecturer_number: str = Query(...),
    course_code: Optional[str] = Query(None),
    report_type: str = Query(default="at-risk-students"),
    session: SessionContext = Depends(get_current_session),
):
    """Legacy endpoint for backward compatibility."""
    _authorize_lecturer_export(session, lecturer_number)

    conn = get_connection()
    cur = conn.cursor()

    try:
        filters = ["lca.lecturer_number = %s"]
        values = [str(lecturer_number)]

        if course_code:
            filters.append("p.course_code = %s")
            values.append(str(course_code))

        where_sql = " AND ".join(filters)

        cur.execute(
            f"""
            WITH latest_prediction_run AS (
                SELECT run_id
                FROM predictive.model_run
                WHERE status = 'SUCCESS'
                ORDER BY finished_at DESC NULLS LAST, started_at DESC
                LIMIT 1
            )
            SELECT DISTINCT
                lca.lecturer_number,
                p.course_code,
                p.student_number,
                sm.first_name,
                sm.last_name,
                sm.email,
                p.risk_probability,
                p.predicted_risk_label,
                p.predicted_at_risk,
                p.generated_at AS prediction_created_at
            FROM latest_prediction_run lpr
            JOIN predictive.student_risk_prediction p
                ON p.run_id = lpr.run_id
            JOIN sakai_raw.lecturer_course_allocation lca
                ON lca.course_code = p.course_code
            LEFT JOIN sakai_raw.student_memberships sm
                ON sm.student_number = p.student_number
                AND sm.site_id LIKE p.course_code || '_%'
            WHERE {where_sql}
            ORDER BY
                p.course_code,
                CASE p.predicted_risk_label
                    WHEN 'HIGH' THEN 1
                    WHEN 'MODERATE' THEN 2
                    ELSE 3
                END,
                p.risk_probability DESC NULLS LAST,
                p.student_number;
            """,
            values,
        )

        rows = cur.fetchall()

        filename_course = course_code or "all_courses"
        filename = (
            f"lecturer_{lecturer_number}_{filename_course}_"
            f"{report_type}_{_timestamp()}.csv"
        )

        return _csv_response(
            filename=filename,
            rows=rows,
            columns=[
                "lecturer_number",
                "course_code",
                "student_number",
                "first_name",
                "last_name",
                "email",
                "risk_probability",
                "predicted_risk_label",
                "predicted_at_risk",
                "prediction_created_at",
            ],
        )

    finally:
        cur.close()
        conn.close()
