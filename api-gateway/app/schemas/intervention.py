from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


InterventionPriority = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]

InterventionStatus = Literal[
    "OPEN",
    "IN_PROGRESS",
    "ESCALATED",
    "RESOLVED",
    "CLOSED",
]


class InterventionCaseCreate(BaseModel):
    student_number: str = Field(..., min_length=1)
    course_code: str = Field(..., min_length=1)

    risk_level: Optional[str] = None
    reason: str = Field(..., min_length=1)
    priority: InterventionPriority = "MEDIUM"

    created_by_role: Literal["LECTURER"] = "LECTURER"
    created_by_identifier: str = Field(..., min_length=1)

    follow_up_date: Optional[date] = None
    note_text: Optional[str] = None


class InterventionNoteCreate(BaseModel):
    note_text: str = Field(..., min_length=1)
    created_by_role: Literal["LECTURER", "ADVISOR", "ADMIN"]
    created_by_identifier: str = Field(..., min_length=1)


class InterventionStatusUpdate(BaseModel):
    new_status: InterventionStatus
    changed_by_role: Literal["LECTURER", "ADVISOR", "ADMIN"]
    changed_by_identifier: str = Field(..., min_length=1)
    change_reason: Optional[str] = None


class InterventionOutcomeCreate(BaseModel):
    outcome_type: Literal[
        "STUDENT_IMPROVED",
        "SUBMITTED_MISSING_WORK",
        "REFERRED_TO_ADVISOR",
        "REFERRED_TO_ADMIN",
        "NO_RESPONSE",
        "DROPPED_COURSE",
        "OTHER",
    ]

    outcome_summary: Optional[str] = None
    resolved_by_role: Literal["LECTURER", "ADVISOR", "ADMIN"]
    resolved_by_identifier: str = Field(..., min_length=1)