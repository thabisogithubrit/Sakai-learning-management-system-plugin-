from pydantic import BaseModel, Field


class FacultyAdminLoginRequest(BaseModel):
    admin_identifier: str = Field(..., min_length=1)


class CourseFacultyAssignmentRequest(BaseModel):
    course_code: str = Field(..., min_length=1)
    faculty_id: str = Field(..., min_length=1)
    assigned_by: str = Field(default="SYSTEM", min_length=1)
    notes: str | None = None
