from app.core.db import get_connection


class FacultyAdminRepository:
    def list_faculties(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT faculty_id, faculty_name, is_active
            FROM faculty.faculty
            WHERE is_active = true
            ORDER BY faculty_name;
            """
        )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def list_admins(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                fa.admin_identifier,
                fa.display_name,
                fa.email,
                fa.faculty_id,
                f.faculty_name,
                fa.is_active
            FROM faculty.faculty_admin fa
            JOIN faculty.faculty f
                ON f.faculty_id = fa.faculty_id
            WHERE fa.is_active = true
            ORDER BY f.faculty_name, fa.display_name;
            """
        )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def get_admin(self, admin_identifier: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                fa.admin_identifier,
                fa.display_name,
                fa.email,
                fa.faculty_id,
                f.faculty_name,
                fa.is_active
            FROM faculty.faculty_admin fa
            JOIN faculty.faculty f
                ON f.faculty_id = fa.faculty_id
            WHERE fa.admin_identifier = %s
              AND fa.is_active = true;
            """,
            (str(admin_identifier),),
        )

        row = cur.fetchone()
        cur.close()
        conn.close()
        return row

    def assign_course_to_faculty(self, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT faculty_id
            FROM faculty.faculty
            WHERE faculty_id = %s
              AND is_active = true;
            """,
            (payload.faculty_id,),
        )
        faculty = cur.fetchone()

        if not faculty:
            cur.close()
            conn.close()
            return None

        cur.execute(
            """
            INSERT INTO faculty.course_faculty_allocation (
                course_code,
                faculty_id,
                assigned_by,
                notes
            )
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (course_code)
            DO UPDATE SET
                faculty_id = EXCLUDED.faculty_id,
                assigned_by = EXCLUDED.assigned_by,
                assigned_at = now(),
                notes = EXCLUDED.notes
            RETURNING *;
            """,
            (
                payload.course_code,
                payload.faculty_id,
                payload.assigned_by,
                payload.notes,
            ),
        )
        row = cur.fetchone()

        cur.execute(
            """
            INSERT INTO faculty.faculty_audit_log (
                actor_identifier,
                action_type,
                entity_type,
                entity_key,
                new_value
            )
            VALUES (%s, 'ASSIGN_COURSE_TO_FACULTY', 'COURSE', %s, %s);
            """,
            (
                payload.assigned_by,
                payload.course_code,
                payload.faculty_id,
            ),
        )

        conn.commit()
        cur.close()
        conn.close()
        return row

    def get_unmapped_courses(self, limit: int = 200):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT course_code, course_title, student_count, student_course_rows
            FROM faculty.unmapped_feature_store_courses
            ORDER BY student_count DESC, course_code
            LIMIT %s;
            """,
            (limit,),
        )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def get_dashboard(self, admin_identifier: str):
        admin = self.get_admin(admin_identifier)

        if not admin:
            return None

        faculty_id = admin["faculty_id"]

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            WITH course_scope AS (
                SELECT course_code
                FROM faculty.course_faculty_allocation
                WHERE faculty_id = %s
            ),
            scoped_features AS (
                SELECT f.*
                FROM feature_store.student_course_features f
                JOIN course_scope cs
                    ON cs.course_code = f.course_code
            ),
            scoped_cases AS (
                SELECT c.*
                FROM intervention."case" c
                JOIN course_scope cs
                    ON cs.course_code = c.course_code
            )
            SELECT
                (SELECT COUNT(*) FROM course_scope) AS assigned_courses,
                (SELECT COUNT(DISTINCT student_number) FROM scoped_features) AS total_students,
                (SELECT COUNT(*) FROM scoped_features WHERE current_risk_level = 'HIGH') AS high_risk_rows,
                (SELECT COUNT(DISTINCT student_number) FROM scoped_features WHERE current_risk_level = 'HIGH') AS high_risk_students,
                (SELECT COUNT(*) FROM scoped_features WHERE current_risk_level = 'MODERATE') AS moderate_risk_rows,
                (SELECT COUNT(*) FROM scoped_cases WHERE status IN ('OPEN', 'IN_PROGRESS')) AS open_cases,
                (SELECT COUNT(*) FROM scoped_cases WHERE status = 'ESCALATED') AS escalated_cases,
                (SELECT COUNT(*) FROM scoped_cases WHERE status IN ('RESOLVED', 'CLOSED')) AS resolved_cases,
                (SELECT COUNT(*) FROM scoped_cases WHERE follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE + INTERVAL '7 days' AND status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED')) AS follow_up_due_cases;
            """,
            (faculty_id,),
        )
        summary = cur.fetchone() or {}

        cur.execute(
            """
            SELECT
                cfa.course_code,
                MAX(f.course_title) AS course_title,
                COUNT(DISTINCT f.student_number) AS student_count,
                COUNT(*) FILTER (WHERE f.current_risk_level = 'HIGH') AS high_risk_rows,
                COUNT(*) FILTER (WHERE f.current_risk_level = 'MODERATE') AS moderate_risk_rows,
                ROUND(AVG(f.avg_assessment_percent), 2) AS avg_assessment_percent,
                MAX(f.generated_at) AS last_feature_refresh
            FROM faculty.course_faculty_allocation cfa
            LEFT JOIN feature_store.student_course_features f
                ON f.course_code = cfa.course_code
            WHERE cfa.faculty_id = %s
            GROUP BY cfa.course_code
            ORDER BY high_risk_rows DESC, moderate_risk_rows DESC, cfa.course_code
            LIMIT 100;
            """,
            (faculty_id,),
        )
        courses = cur.fetchall()

        cur.execute(
            """
            WITH scoped_features AS (
                SELECT f.*
                FROM feature_store.student_course_features f
                JOIN faculty.course_faculty_allocation cfa
                    ON cfa.course_code = f.course_code
                WHERE cfa.faculty_id = %s
            ),
            ranked_students AS (
                SELECT
                    student_number,
                    COUNT(DISTINCT course_code) AS course_count,
                    COUNT(*) FILTER (WHERE current_risk_level = 'HIGH') AS high_risk_courses,
                    COUNT(*) FILTER (WHERE current_risk_level = 'MODERATE') AS moderate_risk_courses,
                    ROUND(AVG(avg_assessment_percent), 2) AS avg_assessment_percent,
                    SUM(total_activity_count) AS total_activity_count,
                    MIN(days_since_last_login) AS days_since_last_login,
                    MAX(generated_at) AS generated_at
                FROM scoped_features
                GROUP BY student_number
            )
            SELECT *
            FROM ranked_students
            ORDER BY
                high_risk_courses DESC,
                moderate_risk_courses DESC,
                avg_assessment_percent ASC NULLS LAST,
                total_activity_count ASC
            LIMIT 150;
            """,
            (faculty_id,),
        )
        students = cur.fetchall()

        cur.execute(
            """
            SELECT
                c.case_id,
                c.student_number,
                c.course_code,
                c.risk_level,
                c.reason,
                c.priority,
                c.status,
                c.created_by_role,
                c.created_by_identifier,
                c.follow_up_date,
                c.created_at,
                c.updated_at,
                COALESCE(n.note_count, 0) AS note_count
            FROM intervention."case" c
            JOIN faculty.course_faculty_allocation cfa
                ON cfa.course_code = c.course_code
            LEFT JOIN (
                SELECT case_id, COUNT(*) AS note_count
                FROM intervention.case_note
                GROUP BY case_id
            ) n ON n.case_id = c.case_id
            WHERE cfa.faculty_id = %s
            ORDER BY
                CASE c.status
                    WHEN 'ESCALATED' THEN 1
                    WHEN 'OPEN' THEN 2
                    WHEN 'IN_PROGRESS' THEN 3
                    ELSE 4
                END,
                CASE c.priority
                    WHEN 'URGENT' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END,
                c.created_at DESC
            LIMIT 100;
            """,
            (faculty_id,),
        )
        interventions = cur.fetchall()

        cur.execute(
            """
            SELECT
                alert_id,
                recipient_role,
                recipient_identifier,
                student_number,
                course_code,
                alert_type,
                title,
                message,
                severity,
                status,
                source_module,
                related_case_id,
                created_at
            FROM notification.alert a
            JOIN faculty.course_faculty_allocation cfa
                ON cfa.course_code = a.course_code
            WHERE cfa.faculty_id = %s
              AND a.status <> 'DISMISSED'
            ORDER BY
                CASE a.severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'WARNING' THEN 2
                    WHEN 'INFO' THEN 3
                    WHEN 'SUCCESS' THEN 4
                    ELSE 5
                END,
                a.created_at DESC
            LIMIT 50;
            """,
            (faculty_id,),
        )
        alerts = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "admin": admin,
            "summary": summary,
            "courses": courses,
            "students": students,
            "interventions": interventions,
            "alerts": alerts,
        }

    def get_student_profile(self, admin_identifier: str, student_number: str):
        admin = self.get_admin(admin_identifier)

        if not admin:
            return None

        faculty_id = admin["faculty_id"]

        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                f.*
            FROM feature_store.student_course_features f
            JOIN faculty.course_faculty_allocation cfa
                ON cfa.course_code = f.course_code
            WHERE cfa.faculty_id = %s
              AND f.student_number = %s
            ORDER BY
                CASE f.current_risk_level
                    WHEN 'HIGH' THEN 1
                    WHEN 'MODERATE' THEN 2
                    WHEN 'ON_TRACK' THEN 3
                    ELSE 4
                END,
                f.course_code;
            """,
            (faculty_id, str(student_number)),
        )
        features = cur.fetchall()

        if not features:
            cur.close()
            conn.close()
            return {
                "student_number": student_number,
                "features": [],
                "interventions": [],
                "alerts": [],
                "access": "NO_FACULTY_RECORDS",
            }

        cur.execute(
            """
            SELECT c.*
            FROM intervention."case" c
            JOIN faculty.course_faculty_allocation cfa
                ON cfa.course_code = c.course_code
            WHERE cfa.faculty_id = %s
              AND c.student_number = %s
            ORDER BY c.created_at DESC;
            """,
            (faculty_id, str(student_number)),
        )
        interventions = cur.fetchall()

        cur.execute(
            """
            SELECT a.*
            FROM notification.alert a
            JOIN faculty.course_faculty_allocation cfa
                ON cfa.course_code = a.course_code
            WHERE cfa.faculty_id = %s
              AND a.student_number = %s
              AND a.status <> 'DISMISSED'
            ORDER BY a.created_at DESC
            LIMIT 50;
            """,
            (faculty_id, str(student_number)),
        )
        alerts = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "student_number": student_number,
            "features": features,
            "interventions": interventions,
            "alerts": alerts,
            "access": "OK",
        }
