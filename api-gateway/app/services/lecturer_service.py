from fastapi import HTTPException
from app.repositories.lecturer_repository import LecturerRepository


class LecturerService:
    def __init__(self):
        self.repo = LecturerRepository()

    def validate_lecturer(self, lecturer_number: str):
        if not lecturer_number:
            raise HTTPException(
                status_code=400,
                detail="Lecturer number is required",
            )

        exists = self.repo.lecturer_exists(lecturer_number)

        if not exists:
            raise HTTPException(
                status_code=404,
                detail="Lecturer number not found in Sakai raw data",
            )

        courses = self.repo.get_lecturer_courses(lecturer_number)

        return {
            "role": "LECTURER",
            "lecturer_number": lecturer_number,
            "courses": courses,
        }

    def list_lecturers(self):
        return self.repo.get_available_lecturers()

    def get_courses(self, lecturer_number: str):
        if not self.repo.lecturer_exists(lecturer_number):
            raise HTTPException(
                status_code=404,
                detail="Lecturer number not found",
            )

        return self.repo.get_lecturer_courses(lecturer_number)

    def get_course_students(self, lecturer_number: str, course_code: str):
        if not self.repo.lecturer_exists(lecturer_number):
            raise HTTPException(
                status_code=404,
                detail="Lecturer number not found",
            )

        return self.repo.get_course_students(lecturer_number, course_code)