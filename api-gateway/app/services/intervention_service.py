from fastapi import HTTPException

from app.repositories.intervention_repository import InterventionRepository


class InterventionService:
    def __init__(self):
        self.repo = InterventionRepository()

    def create_case(self, payload):
        if payload.created_by_role != "LECTURER":
            raise HTTPException(
                status_code=403,
                detail="Only lecturers can create intervention cases for now",
            )

        if not self.repo.lecturer_teaches_course(
            lecturer_number=payload.created_by_identifier,
            course_code=payload.course_code,
        ):
            raise HTTPException(
                status_code=403,
                detail="This lecturer is not assigned to this course",
            )

        if not self.repo.student_belongs_to_course(
            student_number=payload.student_number,
            course_code=payload.course_code,
        ):
            raise HTTPException(
                status_code=400,
                detail="This student is not registered for this course",
            )

        return self.repo.create_case(payload)

    def list_cases(
        self,
        student_number=None,
        course_code=None,
        status=None,
        created_by_role=None,
        created_by_identifier=None,
    ):
        return self.repo.list_cases(
            student_number=student_number,
            course_code=course_code,
            status=status,
            created_by_role=created_by_role,
            created_by_identifier=created_by_identifier,
        )

    def get_case(self, case_id: str):
        case = self.repo.get_case(case_id)

        if not case:
            raise HTTPException(
                status_code=404,
                detail="Intervention case not found",
            )

        return case

    def add_note(self, case_id: str, payload):
        case = self.repo.get_case(case_id)

        if not case:
            raise HTTPException(
                status_code=404,
                detail="Intervention case not found",
            )

        return self.repo.add_note(case_id, payload)

    def update_status(self, case_id: str, payload):
        case = self.repo.update_status(case_id, payload)

        if not case:
            raise HTTPException(
                status_code=404,
                detail="Intervention case not found",
            )

        return case

    def add_outcome(self, case_id: str, payload):
        case = self.repo.get_case(case_id)

        if not case:
            raise HTTPException(
                status_code=404,
                detail="Intervention case not found",
            )

        return self.repo.add_outcome(case_id, payload)