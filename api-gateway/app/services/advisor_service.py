from app.repositories.advisor_repository import AdvisorRepository


class AdvisorService:
    def __init__(self):
        self.repo = AdvisorRepository()

    def validate_advisor(self):
        return {
            "role": "ADVISOR",
            "advisor_identifier": "ACADEMIC_ADVISOR",
            "display_name": "Academic Advisor",
            "scope": "Escalated interventions, follow-ups, and high-risk students",
        }

    def get_dashboard(self):
        return self.repo.get_dashboard()

    def get_student_profile(self, student_number: str):
        return self.repo.get_student_profile(student_number)