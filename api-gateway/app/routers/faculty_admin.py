from fastapi import APIRouter
from fastapi import APIRouter, Depends

from app.core.auth import require_roles

from app.schemas.faculty_admin import (
    CourseFacultyAssignmentRequest,
    FacultyAdminLoginRequest,
)
from app.services.faculty_admin_service import FacultyAdminService

router = APIRouter(
    prefix="/faculty-admin",
    tags=["Faculty Admin"],
    dependencies=[Depends(require_roles("ADMIN"))],
)

faculty_admin_service = FacultyAdminService()


@router.get("/faculties")
def list_faculties():
    return faculty_admin_service.list_faculties()


@router.get("/admins")
def list_faculty_admins():
    return faculty_admin_service.list_admins()


@router.post("/simulate-login")
def simulate_faculty_admin_login(payload: FacultyAdminLoginRequest):
    return {
        "message": "Faculty admin login simulated successfully",
        "session": faculty_admin_service.validate_admin(payload.admin_identifier),
    }


@router.get("/dashboard/{admin_identifier}")
def get_faculty_admin_dashboard(admin_identifier: str):
    return faculty_admin_service.get_dashboard(admin_identifier)


@router.get("/students/{admin_identifier}/{student_number}/profile")
def get_faculty_student_profile(admin_identifier: str, student_number: str):
    return faculty_admin_service.get_student_profile(admin_identifier, student_number)


@router.get("/unmapped-courses")
def get_unmapped_courses():
    return faculty_admin_service.get_unmapped_courses()


@router.post("/course-allocation")
def assign_course_to_faculty(payload: CourseFacultyAssignmentRequest):
    return faculty_admin_service.assign_course_to_faculty(payload)
