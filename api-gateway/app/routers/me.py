from app.core.auth import authenticate_role_password, issue_access_token, require_roles
from app.core.session import SessionContext
from fastapi import Depends, HTTPException
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.lecturer_service import LecturerService
from app.services.student_service import StudentService
from app.services.advisor_service import AdvisorService

router = APIRouter(prefix="/me", tags=["Simulated RBAC"])

lecturer_service = LecturerService()
student_service = StudentService()
advisor_service = AdvisorService()


class SimulatedLoginRequest(BaseModel):
    role: str
    password: str
    lecturer_number: str | None = None
    student_number: str | None = None

@router.get("/roles")
def get_roles():
    return {
        "roles": [
            "STUDENT",
            "LECTURER",
            "ADVISOR",
            "ADMIN",
        ]
    }


@router.post("/simulate-login")
def simulate_login(payload: SimulatedLoginRequest):
    role = payload.role.upper()

    authenticate_role_password(role, payload.password)

    if role == "LECTURER":
        if not payload.lecturer_number:
            raise HTTPException(
                status_code=400,
                detail="lecturer_number is required for lecturer login",
            )

        login_session = lecturer_service.validate_lecturer(payload.lecturer_number)

        auth_session = SessionContext(
            userId=str(payload.lecturer_number),
            displayName=f"Lecturer {payload.lecturer_number}",
            role="LECTURER",
            facultyId="FST",
            allowedCourseIds=[
                str(course.get("course_code"))
                for course in login_session.get("courses", [])
                if course.get("course_code")
            ],
            allowedStudentIds=[],
        )

        token = issue_access_token(auth_session)

        return {
            "message": "Lecturer login successful",
            "session": login_session,
            **token,
        }

    if role == "STUDENT":
        if not payload.student_number:
            raise HTTPException(
                status_code=400,
                detail="student_number is required for student login",
            )

        login_session = student_service.validate_student(payload.student_number)

        auth_session = SessionContext(
            userId=str(payload.student_number),
            displayName=login_session.get("display_name") or str(payload.student_number),
            role="STUDENT",
            facultyId="FST",
            allowedCourseIds=[],
            allowedStudentIds=[str(payload.student_number)],
        )

        token = issue_access_token(auth_session)

        return {
            "message": "Student login successful",
            "session": login_session,
            **token,
        }

    if role == "ADVISOR":
        login_session = advisor_service.validate_advisor()

        auth_session = SessionContext(
            userId="ACADEMIC_ADVISOR",
            displayName="Academic Advisor",
            role="ADVISOR",
            facultyId="FST",
            allowedCourseIds=[],
            allowedStudentIds=[],
        )

        token = issue_access_token(auth_session)

        return {
            "message": "Advisor login successful",
            "session": login_session,
            **token,
        }

    if role == "ADMIN":
        login_session = {
            "role": "ADMIN",
            "display_name": "System Administrator",
            "scope": "SSPA platform administration",
        }

        auth_session = SessionContext(
            userId="ADMIN",
            displayName="System Administrator",
            role="ADMIN",
            facultyId="GLOBAL",
            allowedCourseIds=[],
            allowedStudentIds=[],
        )

        token = issue_access_token(auth_session)

        return {
            "message": "Admin login successful",
            "session": login_session,
            **token,
        }

    raise HTTPException(
        status_code=403,
        detail="Only Student, Lecturer, Advisor, and Admin dashboards are active for now",
    )

@router.get("/lecturers", dependencies=[Depends(require_roles("ADMIN"))])
def get_available_lecturers():
    return lecturer_service.list_lecturers()


@router.get("/students", dependencies=[Depends(require_roles("ADMIN", "ADVISOR"))])
def get_available_students():
    return student_service.list_students()
