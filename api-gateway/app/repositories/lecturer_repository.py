from app.core.db import get_connection


class LecturerRepository:
    def lecturer_exists(self, lecturer_number: str) -> bool:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1
            FROM sakai_raw.lecturer_course_allocation
            WHERE lecturer_number = %s
            LIMIT 1;
            """,
            (str(lecturer_number),),
        )

        result = cur.fetchone()

        cur.close()
        conn.close()

        return result is not None

    def get_available_lecturers(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                lecturer_number,
                COUNT(course_code) AS course_count
            FROM sakai_raw.lecturer_course_allocation
            GROUP BY lecturer_number
            ORDER BY lecturer_number;
            """
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_lecturer_courses(self, lecturer_number: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                lecturer_number,
                course_code,
                ingested_at
            FROM sakai_raw.lecturer_course_allocation
            WHERE lecturer_number = %s
            ORDER BY course_code;
            """,
            (str(lecturer_number),),
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_course_students(self, lecturer_number: str, course_code: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            WITH latest_prediction_run AS (
                SELECT run_id
                FROM predictive.model_run
                WHERE status = 'SUCCESS'
                ORDER BY finished_at DESC NULLS LAST, started_at DESC
                LIMIT 1
            ),
            latest_predictions AS (
                SELECT
                    p.student_number,
                    p.course_code,
                    p.risk_probability,
                    p.predicted_risk_label,
                    p.predicted_at_risk,
                    p.generated_at AS prediction_created_at
                FROM predictive.student_risk_prediction p
                JOIN latest_prediction_run lpr
                    ON lpr.run_id = p.run_id
            ),
            score_events AS (
                SELECT
                    site_id,
                    student_number,
                    percent_score::text AS percent_score
                FROM sakai_raw.gradebook_scores
                WHERE site_id LIKE %s

                UNION ALL

                SELECT
                    site_id,
                    student_number,
                    percent_score::text AS percent_score
                FROM sakai_raw.test_attempts
                WHERE site_id LIKE %s

                UNION ALL

                SELECT
                    site_id,
                    student_number,
                    percent_score::text AS percent_score
                FROM sakai_raw.assignment_submissions
                WHERE site_id LIKE %s
            ),
            student_scores AS (
                SELECT
                    site_id,
                    student_number,
                    AVG(
                        CASE
                            WHEN trim(percent_score) ~ '^[0-9]+(\\.[0-9]+)?$'
                            THEN trim(percent_score)::numeric
                            ELSE NULL
                        END
                    ) AS avg_score,
                    COUNT(*) AS assessment_count
                FROM score_events
                GROUP BY site_id, student_number
            ),
            login_activity AS (
                SELECT
                    student_number,
                    SUM(
                        CASE
                            WHEN trim(login_count) ~ '^[0-9]+$'
                            THEN trim(login_count)::integer
                            ELSE 0
                        END
                    ) AS login_count
                FROM sakai_raw.logins_daily
                GROUP BY student_number
            ),
            resource_activity AS (
                SELECT
                    site_id,
                    student_number,
                    SUM(
                        CASE
                            WHEN trim(resource_count) ~ '^[0-9]+$'
                            THEN trim(resource_count)::integer
                            ELSE 0
                        END
                    ) AS resource_count
                FROM sakai_raw.resources_daily
                WHERE site_id LIKE %s
                GROUP BY site_id, student_number
            )
            SELECT
                sm.site_id,
                sm.sakai_user_id,
                sm.student_number,
                sm.email,
                sm.first_name,
                sm.last_name,
                sm.site_role,

                COALESCE(ss.avg_score, NULL) AS avg_score,
                COALESCE(ss.assessment_count, 0) AS assessment_count,
                COALESCE(la.login_count, 0) AS login_count,
                COALESCE(ra.resource_count, 0) AS resource_count,
                COALESCE(la.login_count, 0) + COALESCE(ra.resource_count, 0) AS activity_count,

                lp.risk_probability,
                lp.predicted_risk_label,
                lp.predicted_at_risk,
                lp.prediction_created_at,

                CASE
                    WHEN lp.predicted_risk_label = 'HIGH' THEN 'high'
                    WHEN lp.predicted_risk_label = 'MODERATE' THEN 'moderate'
                    WHEN lp.predicted_risk_label IN ('LOW', 'ON_TRACK') THEN 'on-track'
                    WHEN lp.predicted_at_risk = 1 THEN 'high'
                    ELSE 'unknown'
                END AS model_risk_level
            FROM sakai_raw.student_memberships sm
            LEFT JOIN student_scores ss
                ON ss.site_id = sm.site_id
                AND ss.student_number = sm.student_number
            LEFT JOIN login_activity la
                ON la.student_number = sm.student_number
            LEFT JOIN resource_activity ra
                ON ra.site_id = sm.site_id
                AND ra.student_number = sm.student_number
            LEFT JOIN latest_predictions lp
                ON lp.student_number = sm.student_number
                AND lp.course_code = %s
            WHERE sm.site_id LIKE %s
              AND EXISTS (
                    SELECT 1
                    FROM sakai_raw.lecturer_course_allocation lca
                    WHERE lca.lecturer_number = %s
                      AND lca.course_code = %s
              )
            ORDER BY
                CASE
                    WHEN lp.predicted_risk_label = 'HIGH' THEN 1
                    WHEN lp.predicted_risk_label = 'MODERATE' THEN 2
                    WHEN lp.predicted_risk_label IN ('LOW', 'ON_TRACK') THEN 3
                    ELSE 4
                END,
                lp.risk_probability DESC NULLS LAST,
                sm.last_name,
                sm.first_name,
                sm.student_number;
            """,
            (
                f"{course_code}_%",
                f"{course_code}_%",
                f"{course_code}_%",
                f"{course_code}_%",
                str(course_code),
                f"{course_code}_%",
                str(lecturer_number),
                str(course_code),
            ),
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows
