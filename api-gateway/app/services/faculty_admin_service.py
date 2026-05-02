from fastapi import HTTPException

from app.repositories.faculty_admin_repository import FacultyAdminRepository


class FacultyAdminService:
    def __init__(self):
        self.repo = FacultyAdminRepository()

    def list_faculties(self):
        return self.repo.list_faculties()

    def list_admins(self):
        return self.repo.list_admins()

    def validate_admin(self, admin_identifier: str):
        admin = self.repo.get_admin(admin_identifier)

        if not admin:
            raise HTTPException(
                status_code=404,
                detail="Faculty admin not found or inactive",
            )

        return {
            "role": "FACULTY_ADMIN",
            "admin_identifier": admin["admin_identifier"],
            "display_name": admin["display_name"],
            "faculty_id": admin["faculty_id"],
            "faculty_name": admin["faculty_name"],
            "scope": f"Students and courses under {admin['faculty_name']}",
        }

    def assign_course_to_faculty(self, payload):
        row = self.repo.assign_course_to_faculty(payload)

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Faculty not found or inactive",
            )

        return row

    def get_unmapped_courses(self):
        return self.repo.get_unmapped_courses()

    def get_dashboard(self, admin_identifier: str):
        dashboard = self.repo.get_dashboard(admin_identifier)

        if not dashboard:
            raise HTTPException(
                status_code=404,
                detail="Faculty admin not found or inactive",
            )

        return dashboard

    def get_student_profile(self, admin_identifier: str, student_number: str):
        profile = self.repo.get_student_profile(admin_identifier, student_number)

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Faculty admin not found or inactive",
            )

        return profile
