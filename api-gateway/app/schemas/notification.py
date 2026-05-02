from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


AlertStatus = Literal["UNREAD", "READ", "DISMISSED"]
AlertSeverity = Literal["INFO", "WARNING", "CRITICAL", "SUCCESS"]


class AlertCreate(BaseModel):
    recipient_role: Literal["STUDENT", "LECTURER", "ADVISOR", "ADMIN"]
    recipient_identifier: str = Field(..., min_length=1)

    student_number: Optional[str] = None
    course_code: Optional[str] = None

    alert_type: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)

    severity: AlertSeverity = "INFO"
    source_module: str = "SYSTEM"
    related_case_id: Optional[UUID] = None

    created_by_role: Literal["LECTURER", "ADVISOR", "ADMIN", "SYSTEM"] = "SYSTEM"
    created_by_identifier: str = "SYSTEM"


class AlertStatusUpdate(BaseModel):
    status: AlertStatus
    changed_by_role: Literal["STUDENT", "LECTURER", "ADVISOR", "ADMIN", "SYSTEM"]
    changed_by_identifier: str = Field(..., min_length=1)
    change_reason: Optional[str] = None