from fastapi import APIRouter, Query
from fastapi import APIRouter, Depends, Query

from app.core.auth import require_roles

from app.schemas.intervention import (
    InterventionCaseCreate,
    InterventionNoteCreate,
    InterventionOutcomeCreate,
    InterventionStatusUpdate,
)
from app.services.intervention_service import InterventionService

router = APIRouter(
    prefix="/interventions",
    tags=["Interventions"],
    dependencies=[Depends(require_roles("STUDENT", "LECTURER", "ADVISOR", "ADMIN"))],
)

intervention_service = InterventionService()


@router.post("/cases")
def create_intervention_case(payload: InterventionCaseCreate):
    return intervention_service.create_case(payload)


@router.get("/cases")
def list_intervention_cases(
    student_number: str | None = Query(default=None),
    course_code: str | None = Query(default=None),
    status: str | None = Query(default=None),
    created_by_role: str | None = Query(default=None),
    created_by_identifier: str | None = Query(default=None),
):
    return intervention_service.list_cases(
        student_number=student_number,
        course_code=course_code,
        status=status,
        created_by_role=created_by_role,
        created_by_identifier=created_by_identifier,
    )


@router.get("/cases/{case_id}")
def get_intervention_case(case_id: str):
    return intervention_service.get_case(case_id)


@router.post("/cases/{case_id}/notes")
def add_intervention_note(case_id: str, payload: InterventionNoteCreate):
    return intervention_service.add_note(case_id, payload)


@router.patch("/cases/{case_id}/status")
def update_intervention_status(case_id: str, payload: InterventionStatusUpdate):
    return intervention_service.update_status(case_id, payload)


@router.post("/cases/{case_id}/outcome")
def add_intervention_outcome(case_id: str, payload: InterventionOutcomeCreate):
    return intervention_service.add_outcome(case_id, payload)