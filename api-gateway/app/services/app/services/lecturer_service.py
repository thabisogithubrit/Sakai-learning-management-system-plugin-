import pandas as pd
from app.core.session import SessionContext

BASE_PATH = "C:/SAKAILMSPLUGIN/feature-store-etl/data/curated"

def get_lecturer_dashboard(session: SessionContext, course_id: str | None):
    if session.role != "LECTURER":
        raise Exception("Access denied")

    courses = pd.read_csv(f"{BASE_PATH}/courses.csv")
    assignments = pd.read_csv(f"{BASE_PATH}/lecturer_course_assignments.csv")
    enrollments = pd.read_csv(f"{BASE_PATH}/enrollments.csv")
    features = pd.read_csv(f"{BASE_PATH}/features.csv")

    # Filter lecturer courses
    lecturer_courses = assignments[assignments["lecturerId"] == session.userId]
    lecturer_courses = lecturer_courses.merge(courses, on="courseId")

    if course_id:
        lecturer_courses = lecturer_courses[lecturer_courses["courseId"] == course_id]

    course_ids = lecturer_courses["courseId"].unique()

    # Students in those courses
    enrolled = enrollments[enrollments["courseId"].isin(course_ids)]

    # Join with features (risk indicators)
    merged = enrolled.merge(features, on="studentId", how="left")

    total_students = merged["studentId"].nunique()
    at_risk = merged[merged["risk_level"] == "HIGH"]["studentId"].nunique()
    avg_grade = merged["grade"].mean()

    flagged = merged[merged["risk_level"].isin(["HIGH", "MEDIUM"])][
        ["studentId", "risk_level"]
    ].drop_duplicates()

    return {
        "lecturer": {
            "userId": session.userId,
            "displayName": session.displayName,
            "facultyId": session.facultyId,
            "role": session.role,
        },
        "courses": lecturer_courses[["courseId", "courseName"]].to_dict("records"),
        "selectedCourse": course_id,
        "courseSummary": {
            "totalStudents": int(total_students),
            "atRiskStudents": int(at_risk),
            "averageGrade": float(avg_grade) if avg_grade else 0,
        },
        "flaggedStudents": flagged.rename(
            columns={"risk_level": "risk"}
        ).to_dict("records"),
    }