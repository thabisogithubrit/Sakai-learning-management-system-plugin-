from fastapi import HTTPException

from app.repositories.notification_repository import NotificationRepository


class NotificationService:
    def __init__(self):
        self.repo = NotificationRepository()

    def create_alert(self, payload):
        return self.repo.create_alert(payload)

    def list_alerts(
        self,
        recipient_role=None,
        recipient_identifier=None,
        status=None,
        severity=None,
        student_number=None,
        course_code=None,
    ):
        return self.repo.list_alerts(
            recipient_role=recipient_role,
            recipient_identifier=recipient_identifier,
            status=status,
            severity=severity,
            student_number=student_number,
            course_code=course_code,
        )

    def get_alert(self, alert_id: str):
        alert = self.repo.get_alert(alert_id)

        if not alert:
            raise HTTPException(
                status_code=404,
                detail="Alert not found",
            )

        return alert

    def update_status(self, alert_id: str, payload):
        alert = self.repo.update_status(alert_id, payload)

        if not alert:
            raise HTTPException(
                status_code=404,
                detail="Alert not found",
            )

        return alert

    def get_unread_count(self, recipient_role: str, recipient_identifier: str):
        return self.repo.get_unread_count(
            recipient_role=recipient_role,
            recipient_identifier=recipient_identifier,
        )
    
    def create_at_risk_alerts_for_run(
        self,
        run_id: str | None = None,
        include_moderate: bool = True,
    ):
        return self.repo.create_at_risk_alerts_for_run(
            run_id=run_id,
            include_moderate=include_moderate,
        )
    
    def create_alerts_for_escalated_cases(self):
        return self.repo.create_alerts_for_escalated_cases()    