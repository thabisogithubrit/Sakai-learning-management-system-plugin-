from fastapi import HTTPException
from app.repositories.student_repository import StudentRepository


class StudentService:
    def __init__(self):
        self.repo = StudentRepository()

    def validate_student(self, student_number: str):
        if not student_number:
            raise HTTPException(
                status_code=400,
                detail="Student number is required",
            )

        exists = self.repo.student_exists(student_number)

        if not exists:
            raise HTTPException(
                status_code=404,
                detail="Student number not found in Sakai raw data",
            )

        profile = self.repo.get_student_profile(student_number)

        return {
            "role": "STUDENT",
            "student_number": str(student_number),
            "display_name": self._get_display_name(profile),
            "profile": profile,
        }

    def list_students(self):
        return self.repo.get_available_students()

    def get_dashboard(self, student_number: str):
        if not self.repo.student_exists(student_number):
            raise HTTPException(
                status_code=404,
                detail="Student number not found",
            )

        profile = self.repo.get_student_profile(student_number)
        courses = self.repo.get_student_courses(student_number)
        activity = self.repo.get_student_activity(student_number)
        recent_scores = self.repo.get_recent_scores(student_number)

        return {
            "profile": profile,
            "courses": courses,
            "activity": activity,
            "recent_scores": recent_scores,
        }

    def _get_display_name(self, profile):
        if not profile:
            return ""

        first_name = profile.get("first_name") or ""
        last_name = profile.get("last_name") or ""
        full_name = f"{first_name} {last_name}".strip()

        return full_name or profile.get("student_number") or ""