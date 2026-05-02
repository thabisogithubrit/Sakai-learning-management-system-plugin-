from fastapi import APIRouter, Depends
from app.core.auth import require_roles
from app.services.student_service import StudentService

router = APIRouter(
    prefix="/student",
    tags=["Student Dashboard"],
    dependencies=[Depends(require_roles("STUDENT", "ADVISOR", "ADMIN"))],
)

student_service = StudentService()


@router.get("/{student_number}/dashboard")
def get_student_dashboard(student_number: str):
    return student_service.get_dashboard(student_number)


@router.get("/{student_number}/courses")
def get_student_courses(student_number: str):
    dashboard = student_service.get_dashboard(student_number)
    return dashboard["courses"]