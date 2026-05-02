from app.core.db import get_connection


VALID_STUDENT_NUMBER_FILTER = """
student_number IS NOT NULL
AND trim(student_number) <> ''
AND trim(student_number) !~* '@'
AND trim(student_number) ~* '^(s)?[0-9]{6,}$'
"""


class StudentRepository:
    def student_exists(self, student_number: str) -> bool:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            f"""
            SELECT 1
            FROM sakai_raw.student_memberships
            WHERE student_number = %s
              AND {VALID_STUDENT_NUMBER_FILTER}
            LIMIT 1;
            """,
            (str(student_number),),
        )

        result = cur.fetchone()

        cur.close()
        conn.close()

        return result is not None

    def get_available_students(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            f"""
            SELECT
                student_number,
                MAX(NULLIF(first_name, '')) AS first_name,
                MAX(NULLIF(last_name, '')) AS last_name,
                COUNT(DISTINCT site_id) AS course_count
            FROM sakai_raw.student_memberships
            WHERE {VALID_STUDENT_NUMBER_FILTER}
            GROUP BY student_number
            ORDER BY student_number
            LIMIT 500;
            """
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_student_profile(self, student_number: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            f"""
            SELECT
                student_number,
                MAX(NULLIF(first_name, '')) AS first_name,
                MAX(NULLIF(last_name, '')) AS last_name,
                COUNT(DISTINCT site_id) AS course_count
            FROM sakai_raw.student_memberships
            WHERE student_number = %s
              AND {VALID_STUDENT_NUMBER_FILTER}
            GROUP BY student_number;
            """,
            (str(student_number),),
        )

        row = cur.fetchone()

        cur.close()
        conn.close()

        return row

    def get_student_courses(self, student_number: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            WITH memberships AS (
                SELECT DISTINCT
                    sm.site_id,
                    sm.student_number,
                    sm.site_role
                FROM sakai_raw.student_memberships sm
                WHERE sm.student_number = %s
            ),
            score_events AS (
                SELECT
                    site_id,
                    student_number,
                    percent_score::text AS percent_score
                FROM sakai_raw.gradebook_scores
                WHERE student_number = %s

                UNION ALL

                SELECT
                    site_id,
                    student_number,
                    percent_score::text AS percent_score
                FROM sakai_raw.test_attempts
                WHERE student_number = %s

                UNION ALL

                SELECT
                    site_id,
                    student_number,
                    percent_score::text AS percent_score
                FROM sakai_raw.assignment_submissions
                WHERE student_number = %s
            ),
            course_scores AS (
                SELECT
                    site_id,
                    student_number,
                    ROUND(
                        AVG(
                            CASE
                                WHEN trim(percent_score) ~ '^[0-9]+(\\.[0-9]+)?$'
                                THEN trim(percent_score)::numeric
                                ELSE NULL
                            END
                        ),
                        2
                    )::float AS avg_score,
                    COUNT(*) AS assessment_count
                FROM score_events
                GROUP BY site_id, student_number
            ),
            course_resources AS (
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
                WHERE student_number = %s
                GROUP BY site_id, student_number
            )
            SELECT
                m.site_id,
                split_part(m.site_id, '_', 1) AS course_code,
                COALESCE(s.site_title, m.site_id) AS course_title,
                COALESCE(s.term_label, '') AS term_label,
                COALESCE(s.site_type, '') AS site_type,
                m.site_role,
                cs.avg_score,
                COALESCE(cs.assessment_count, 0) AS assessment_count,
                COALESCE(cr.resource_count, 0) AS resource_count
            FROM memberships m
            LEFT JOIN sakai_raw.sites s
                ON s.site_id = m.site_id
            LEFT JOIN course_scores cs
                ON cs.site_id = m.site_id
                AND cs.student_number = m.student_number
            LEFT JOIN course_resources cr
                ON cr.site_id = m.site_id
                AND cr.student_number = m.student_number
            ORDER BY course_code, site_id;
            """,
            (
                str(student_number),
                str(student_number),
                str(student_number),
                str(student_number),
                str(student_number),
            ),
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_student_activity(self, student_number: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            WITH login_activity AS (
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
                WHERE student_number = %s
                GROUP BY student_number
            ),
            resource_activity AS (
                SELECT
                    student_number,
                    SUM(
                        CASE
                            WHEN trim(resource_count) ~ '^[0-9]+$'
                            THEN trim(resource_count)::integer
                            ELSE 0
                        END
                    ) AS resource_count
                FROM sakai_raw.resources_daily
                WHERE student_number = %s
                GROUP BY student_number
            )
            SELECT
                COALESCE(la.login_count, 0) AS login_count,
                COALESCE(ra.resource_count, 0) AS resource_count,
                COALESCE(la.login_count, 0) + COALESCE(ra.resource_count, 0) AS total_activity
            FROM (SELECT %s::text AS student_number) base
            LEFT JOIN login_activity la
                ON la.student_number = base.student_number
            LEFT JOIN resource_activity ra
                ON ra.student_number = base.student_number;
            """,
            (str(student_number), str(student_number), str(student_number)),
        )

        row = cur.fetchone()

        cur.close()
        conn.close()

        return row

    def get_recent_scores(self, student_number: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            WITH score_events AS (
                SELECT
                    site_id,
                    split_part(site_id, '_', 1) AS course_code,
                    item_name::text AS item_title,
                    percent_score::text AS percent_score,
                    points_earned::text AS points_earned,
                    points_possible::text AS points_possible,
                    date_recorded::text AS recorded_at,
                    'Gradebook' AS source
                FROM sakai_raw.gradebook_scores
                WHERE student_number = %s

                UNION ALL

                SELECT
                    site_id,
                    split_part(site_id, '_', 1) AS course_code,
                    assessment_title::text AS item_title,
                    percent_score::text AS percent_score,
                    final_score::text AS points_earned,
                    points_possible::text AS points_possible,
                    submitted_date::text AS recorded_at,
                    'Test' AS source
                FROM sakai_raw.test_attempts
                WHERE student_number = %s

                UNION ALL

                SELECT
                    site_id,
                    split_part(site_id, '_', 1) AS course_code,
                    assignment_title::text AS item_title,
                    percent_score::text AS percent_score,
                    raw_grade::text AS points_earned,
                    points_possible::text AS points_possible,
                    submitted_date::text AS recorded_at,
                    'Assignment' AS source
                FROM sakai_raw.assignment_submissions
                WHERE student_number = %s
            )
            SELECT
                site_id,
                course_code,
                item_title,
                percent_score,
                points_earned,
                points_possible,
                recorded_at,
                source
            FROM score_events
            ORDER BY recorded_at DESC NULLS LAST
            LIMIT 30;
            """,
            (str(student_number), str(student_number), str(student_number)),
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows