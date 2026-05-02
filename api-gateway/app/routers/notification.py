from fastapi import APIRouter, Query
from fastapi import APIRouter, Depends, Query

from app.core.auth import require_roles
from app.schemas.notification import AlertCreate, AlertStatusUpdate
from app.services.notification_service import NotificationService

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
    dependencies=[Depends(require_roles("STUDENT", "LECTURER", "ADVISOR", "ADMIN"))],
)

notification_service = NotificationService()


@router.post("/alerts")
def create_alert(payload: AlertCreate):
    return notification_service.create_alert(payload)


@router.get("/alerts")
def list_alerts(
    recipient_role: str | None = Query(default=None),
    recipient_identifier: str | None = Query(default=None),
    status: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    student_number: str | None = Query(default=None),
    course_code: str | None = Query(default=None),
):
    return notification_service.list_alerts(
        recipient_role=recipient_role,
        recipient_identifier=recipient_identifier,
        status=status,
        severity=severity,
        student_number=student_number,
        course_code=course_code,
    )

@router.post("/alerts/from-escalated-cases")
def create_alerts_from_escalated_cases():
    return notification_service.create_alerts_for_escalated_cases()

@router.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    return notification_service.get_alert(alert_id)


@router.patch("/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, payload: AlertStatusUpdate):
    return notification_service.update_status(alert_id, payload)


@router.get("/unread-count")
def get_unread_count(
    recipient_role: str = Query(...),
    recipient_identifier: str = Query(...),
):
    return notification_service.get_unread_count(
        recipient_role=recipient_role,
        recipient_identifier=recipient_identifier,
    )

@router.post("/alerts/from-risk-predictions")
def create_alerts_from_risk_predictions(
    run_id: str | None = Query(default=None),
    include_moderate: bool = Query(default=True),
):
    return notification_service.create_at_risk_alerts_for_run(
        run_id=run_id,
        include_moderate=include_moderate,
    )