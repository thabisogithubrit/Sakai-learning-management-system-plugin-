from __future__ import annotations
import os
from typing import List, Optional
from fastapi import Header
from pydantic import BaseModel
from pydantic import BaseModel, Field


class SessionContext(BaseModel):
    userId: str
    displayName: str
    role: str
    facultyId: str
    allowedCourseIds: List[str] = Field(default_factory=list)
    allowedStudentIds: List[str] = Field(default_factory=list)


DEV_SESSION_PROFILES = {
    "LECTURER": SessionContext(
        userId="lecturer-001",
        displayName="Dr. Mpho Rakotsoane",
        role="LECTURER",
        facultyId="FST",
        allowedCourseIds=["CSC201", "CSC204"],
        allowedStudentIds=[],
    ),
    "STUDENT": SessionContext(
        userId="student-001",
        displayName="Tumelo Qhobela",
        role="STUDENT",
        facultyId="FST",
        allowedCourseIds=["CSC201", "CSC204", "MAT201"],
        allowedStudentIds=[],
    ),
    "ADVISOR": SessionContext(
        userId="advisor-001",
        displayName="Ms. Lineo Sefako",
        role="ADVISOR",
        facultyId="FST",
        allowedCourseIds=[],
        allowedStudentIds=["stu-201", "stu-202", "stu-203"],
    ),
    "FACULTY_ADMIN": SessionContext(
        userId="faculty-admin-001",
        displayName="Faculty Admin",
        role="FACULTY_ADMIN",
        facultyId="FST",
        allowedCourseIds=[],
        allowedStudentIds=[],
    ),
    "SYSTEM_ADMIN": SessionContext(
        userId="system-admin-001",
        displayName="System Admin",
        role="SYSTEM_ADMIN",
        facultyId="GLOBAL",
        allowedCourseIds=[],
        allowedStudentIds=[],
    ),
}


def get_session_context(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_role: Optional[str] = Header(None, alias="X-Role"),
    x_faculty_id: Optional[str] = Header(None, alias="X-Faculty-Id"),
):
    if x_user_id and x_role and x_faculty_id:
        return SessionContext(
            userId=x_user_id,
            displayName=x_user_id,
            role=x_role,
            facultyId=x_faculty_id,
            allowedCourseIds=[],
            allowedStudentIds=[],
        )

    active_profile = os.getenv("SSPA_DEV_SESSION_PROFILE", "LECTURER").upper()
    return DEV_SESSION_PROFILES.get(active_profile, DEV_SESSION_PROFILES["LECTURER"])