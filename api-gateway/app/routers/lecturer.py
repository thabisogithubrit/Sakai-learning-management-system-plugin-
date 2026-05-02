from fastapi import APIRouter, Depends
from app.core.auth import require_roles
from app.services.lecturer_service import LecturerService

router = APIRouter(
    prefix="/lecturer",
    tags=["Lecturer Dashboard"],
    dependencies=[Depends(require_roles("LECTURER", "ADMIN"))],
)

lecturer_service = LecturerService()


@router.get("/courses/{lecturer_number}")
def get_lecturer_courses(lecturer_number: str):
    return lecturer_service.get_courses(lecturer_number)


@router.get("/courses/{lecturer_number}/{course_code}/students")
def get_course_students(lecturer_number: str, course_code: str):
    return lecturer_service.get_course_students(lecturer_number, course_code)