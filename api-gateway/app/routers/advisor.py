from fastapi import APIRouter, Depends

from app.core.auth import require_roles
from app.services.advisor_service import AdvisorService

router = APIRouter(
    prefix="/advisor",
    tags=["Advisor Dashboard"],
    dependencies=[Depends(require_roles("ADVISOR", "ADMIN"))],
)

advisor_service = AdvisorService()


@router.get("/dashboard")
def get_advisor_dashboard():
    return advisor_service.get_dashboard()


@router.get("/students/{student_number}/profile")
def get_advisor_student_profile(student_number: str):
    return advisor_service.get_student_profile(student_number)