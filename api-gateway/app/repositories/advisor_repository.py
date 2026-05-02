from app.core.db import get_connection


class AdvisorRepository:
    def get_dashboard(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                COUNT(*) AS total_cases,
                COUNT(*) FILTER (WHERE status = 'OPEN') AS open_cases,
                COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_cases,
                COUNT(*) FILTER (WHERE status = 'ESCALATED') AS escalated_cases,
                COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED')) AS resolved_cases,
                COUNT(*) FILTER (
                    WHERE follow_up_date IS NOT NULL
                      AND follow_up_date <= CURRENT_DATE + INTERVAL '7 days'
                      AND status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED')
                ) AS follow_up_due_cases
            FROM intervention."case";
            """
        )
        case_summary = cur.fetchone() or {}

        cur.execute(
            """
            SELECT
                COUNT(*) AS high_risk_students
            FROM feature_store.student_course_features
            WHERE current_risk_level = 'HIGH';
            """
        )
        risk_summary = cur.fetchone() or {}

        cur.execute(
            """
            SELECT
                COUNT(*) AS unread_alerts
            FROM notification.alert
            WHERE recipient_role = 'ADVISOR'
              AND status = 'UNREAD';
            """
        )
        alert_summary = cur.fetchone() or {}

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
            LEFT JOIN (
                SELECT case_id, COUNT(*) AS note_count
                FROM intervention.case_note
                GROUP BY case_id
            ) n ON n.case_id = c.case_id
            WHERE c.status = 'ESCALATED'
               OR c.priority IN ('HIGH', 'URGENT')
            ORDER BY
                CASE c.priority
                    WHEN 'URGENT' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END,
                c.created_at DESC
            LIMIT 50;
            """
        )
        escalated_cases = cur.fetchall()

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
            LEFT JOIN (
                SELECT case_id, COUNT(*) AS note_count
                FROM intervention.case_note
                GROUP BY case_id
            ) n ON n.case_id = c.case_id
            WHERE c.follow_up_date IS NOT NULL
              AND c.follow_up_date <= CURRENT_DATE + INTERVAL '7 days'
              AND c.status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED')
            ORDER BY
                c.follow_up_date ASC,
                CASE c.priority
                    WHEN 'URGENT' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END
            LIMIT 50;
            """
        )
        follow_up_cases = cur.fetchall()

        cur.execute(
            """
            SELECT
                student_number,
                site_id,
                course_code,
                course_title,
                term_label,
                current_risk_level,
                avg_assessment_percent,
                total_assessment_records,
                missing_assessment_estimate,
                login_count_total,
                resource_action_total,
                total_activity_count,
                days_since_last_login,
                days_since_last_resource,
                generated_at
            FROM feature_store.student_course_features
            WHERE current_risk_level IN ('HIGH', 'MODERATE')
            ORDER BY
                CASE current_risk_level
                    WHEN 'HIGH' THEN 1
                    WHEN 'MODERATE' THEN 2
                    ELSE 3
                END,
                avg_assessment_percent ASC NULLS LAST,
                total_activity_count ASC
            LIMIT 50;
            """
        )
        high_risk_students = cur.fetchall()

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
            FROM notification.alert
            WHERE recipient_role = 'ADVISOR'
              AND status <> 'DISMISSED'
            ORDER BY
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'WARNING' THEN 2
                    WHEN 'INFO' THEN 3
                    WHEN 'SUCCESS' THEN 4
                    ELSE 5
                END,
                created_at DESC
            LIMIT 30;
            """
        )
        advisor_alerts = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "summary": {
                "total_cases": case_summary.get("total_cases", 0),
                "open_cases": case_summary.get("open_cases", 0),
                "in_progress_cases": case_summary.get("in_progress_cases", 0),
                "escalated_cases": case_summary.get("escalated_cases", 0),
                "resolved_cases": case_summary.get("resolved_cases", 0),
                "follow_up_due_cases": case_summary.get("follow_up_due_cases", 0),
                "high_risk_students": risk_summary.get("high_risk_students", 0),
                "unread_alerts": alert_summary.get("unread_alerts", 0),
            },
            "escalated_cases": escalated_cases,
            "follow_up_cases": follow_up_cases,
            "high_risk_students": high_risk_students,
            "advisor_alerts": advisor_alerts,
        }

    def get_student_profile(self, student_number: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                student_number,
                site_id,
                course_code,
                course_title,
                term_label,
                current_risk_level,
                avg_assessment_percent,
                total_assessment_records,
                scored_assessment_records,
                missing_assessment_estimate,
                low_score_count,
                moderate_score_count,
                good_score_count,
                login_count_total,
                login_days_active,
                days_since_last_login,
                resource_action_total,
                resource_days_active,
                distinct_resources_accessed,
                days_since_last_resource,
                total_activity_count,
                coursework_percent,
                terminal_percent_score,
                target_at_risk,
                target_source,
                generated_at
            FROM feature_store.student_course_features
            WHERE student_number = %s
            ORDER BY
                CASE current_risk_level
                    WHEN 'HIGH' THEN 1
                    WHEN 'MODERATE' THEN 2
                    WHEN 'ON_TRACK' THEN 3
                    ELSE 4
                END,
                course_code;
            """,
            (str(student_number),),
        )
        features = cur.fetchall()

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
            LEFT JOIN (
                SELECT case_id, COUNT(*) AS note_count
                FROM intervention.case_note
                GROUP BY case_id
            ) n ON n.case_id = c.case_id
            WHERE c.student_number = %s
            ORDER BY c.created_at DESC;
            """,
            (str(student_number),),
        )
        cases = cur.fetchall()

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
            FROM notification.alert
            WHERE student_number = %s
              AND status <> 'DISMISSED'
            ORDER BY created_at DESC
            LIMIT 30;
            """,
            (str(student_number),),
        )
        alerts = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "student_number": student_number,
            "features": features,
            "cases": cases,
            "alerts": alerts,
        }