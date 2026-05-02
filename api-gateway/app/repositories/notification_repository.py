from app.core.db import get_connection


class NotificationRepository:
    def create_alert(self, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT notification.create_in_app_alert(
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s
            ) AS alert_id;
            """,
            (
                payload.recipient_role,
                payload.recipient_identifier,
                payload.student_number,
                payload.course_code,
                payload.alert_type,
                payload.title,
                payload.message,
                payload.severity,
                payload.source_module,
                str(payload.related_case_id) if payload.related_case_id else None,
                payload.created_by_role,
                payload.created_by_identifier,
            ),
        )

        alert_id = cur.fetchone()["alert_id"]
        conn.commit()

        cur.execute(
            """
            SELECT *
            FROM notification.alert
            WHERE alert_id = %s;
            """,
            (str(alert_id),),
        )

        row = cur.fetchone()

        cur.close()
        conn.close()

        return row

    def list_alerts(
        self,
        recipient_role=None,
        recipient_identifier=None,
        status=None,
        severity=None,
        student_number=None,
        course_code=None,
    ):
        conn = get_connection()
        cur = conn.cursor()

        filters = []
        values = []

        if recipient_role:
            filters.append("recipient_role = %s")
            values.append(str(recipient_role))

        if recipient_identifier:
            filters.append("recipient_identifier = %s")
            values.append(str(recipient_identifier))

        if status:
            filters.append("status = %s")
            values.append(str(status))

        if severity:
            filters.append("severity = %s")
            values.append(str(severity))

        if student_number:
            filters.append("student_number = %s")
            values.append(str(student_number))

        if course_code:
            filters.append("course_code = %s")
            values.append(str(course_code))

        where_sql = ""
        if filters:
            where_sql = "WHERE " + " AND ".join(filters)

        cur.execute(
            f"""
            SELECT *
            FROM notification.alert
            {where_sql}
            ORDER BY
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'WARNING' THEN 2
                    WHEN 'INFO' THEN 3
                    WHEN 'SUCCESS' THEN 4
                    ELSE 5
                END,
                created_at DESC;
            """,
            values,
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_alert(self, alert_id: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM notification.alert
            WHERE alert_id = %s;
            """,
            (str(alert_id),),
        )

        alert = cur.fetchone()

        if not alert:
            cur.close()
            conn.close()
            return None

        cur.execute(
            """
            SELECT *
            FROM notification.alert_status_history
            WHERE alert_id = %s
            ORDER BY changed_at DESC;
            """,
            (str(alert_id),),
        )

        history = cur.fetchall()

        cur.execute(
            """
            SELECT *
            FROM notification.alert_delivery
            WHERE alert_id = %s
            ORDER BY delivered_at DESC NULLS LAST;
            """,
            (str(alert_id),),
        )

        deliveries = cur.fetchall()

        cur.close()
        conn.close()

        alert["history"] = history
        alert["deliveries"] = deliveries

        return alert

    def update_status(self, alert_id: str, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT status
            FROM notification.alert
            WHERE alert_id = %s;
            """,
            (str(alert_id),),
        )

        existing = cur.fetchone()

        if not existing:
            cur.close()
            conn.close()
            return None

        old_status = existing["status"]

        cur.execute(
            """
            UPDATE notification.alert
            SET status = %s
            WHERE alert_id = %s
            RETURNING *;
            """,
            (payload.status, str(alert_id)),
        )

        alert = cur.fetchone()

        cur.execute(
            """
            INSERT INTO notification.alert_status_history (
                alert_id,
                old_status,
                new_status,
                changed_by_role,
                changed_by_identifier,
                change_reason
            )
            VALUES (%s, %s, %s, %s, %s, %s);
            """,
            (
                str(alert_id),
                old_status,
                payload.status,
                payload.changed_by_role,
                payload.changed_by_identifier,
                payload.change_reason,
            ),
        )

        conn.commit()

        cur.close()
        conn.close()

        return alert

    def create_at_risk_alerts_for_run(
        self,
        run_id: str | None = None,
        include_moderate: bool = True,
    ):
        """
        Automatically create lecturer alerts for at-risk students
        from a predictive model run.
        """
        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                WITH selected_run AS (
                    SELECT COALESCE(
                        %s::uuid,
                        (
                            SELECT run_id
                            FROM predictive.model_run
                            WHERE status = 'SUCCESS'
                            ORDER BY finished_at DESC NULLS LAST, started_at DESC
                            LIMIT 1
                        )
                    ) AS run_id
                ),
                alert_targets AS (
                    SELECT DISTINCT
                        sr.run_id,
                        lca.lecturer_number,
                        p.student_number,
                        p.course_code,
                        p.risk_probability,
                        p.predicted_risk_label,
                        CASE p.predicted_risk_label
                            WHEN 'HIGH' THEN 1
                            WHEN 'MODERATE' THEN 2
                            ELSE 3
                        END AS risk_rank
                    FROM selected_run sr
                    JOIN predictive.student_risk_prediction p
                        ON p.run_id = sr.run_id
                    JOIN sakai_raw.lecturer_course_allocation lca
                        ON lca.course_code = p.course_code
                    WHERE sr.run_id IS NOT NULL
                      AND p.student_number IS NOT NULL
                      AND p.course_code IS NOT NULL
                      AND lca.lecturer_number IS NOT NULL
                      AND (
                            p.predicted_at_risk = 1
                            OR p.predicted_risk_label = 'HIGH'
                            OR (%s = TRUE AND p.predicted_risk_label = 'MODERATE')
                      )
                      AND NOT EXISTS (
                            SELECT 1
                            FROM notification.alert existing
                            WHERE existing.recipient_role = 'LECTURER'
                              AND existing.recipient_identifier = lca.lecturer_number
                              AND existing.student_number = p.student_number
                              AND existing.course_code = p.course_code
                              AND existing.alert_type = 'AT_RISK_STUDENT'
                              AND existing.source_module = 'PREDICTIVE'
                              AND existing.status IN ('UNREAD', 'READ')
                      )
                )
                SELECT
                    run_id,
                    lecturer_number,
                    student_number,
                    course_code,
                    risk_probability,
                    predicted_risk_label,
                    risk_rank
                FROM alert_targets
                ORDER BY
                    risk_rank,
                    risk_probability DESC NULLS LAST,
                    lecturer_number,
                    student_number;
                """,
                (str(run_id) if run_id else None, include_moderate),
            )

            targets = cur.fetchall()
            created_alert_ids = []

            for target in targets:
                risk_label = str(target.get("predicted_risk_label") or "HIGH")
                severity = "CRITICAL" if risk_label == "HIGH" else "WARNING"

                probability = target.get("risk_probability")
                probability_text = (
                    "unknown"
                    if probability is None
                    else f"{float(probability) * 100:.1f}%"
                )

                title = f"{risk_label.replace('_', ' ').title()} risk student identified"

                message = (
                    f"Student {target['student_number']} has been identified as "
                    f"{risk_label.replace('_', ' ').lower()} risk in course "
                    f"{target['course_code']}. Risk probability: {probability_text}. "
                    "Please review the student profile and create an intervention if needed."
                )

                cur.execute(
                    """
                    SELECT notification.create_in_app_alert(
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s
                    ) AS alert_id;
                    """,
                    (
                        "LECTURER",
                        str(target["lecturer_number"]),
                        str(target["student_number"]),
                        str(target["course_code"]),
                        "AT_RISK_STUDENT",
                        title,
                        message,
                        severity,
                        "PREDICTIVE",
                        None,
                        "SYSTEM",
                        "PREDICTIVE_ENGINE",
                    ),
                )

                created = cur.fetchone()

                if created and created.get("alert_id"):
                    created_alert_ids.append(str(created["alert_id"]))

            conn.commit()

            return {
                "run_id": str(targets[0]["run_id"]) if targets else str(run_id) if run_id else None,
                "eligible_alert_targets": len(targets),
                "alerts_created": len(created_alert_ids),
                "alert_ids": created_alert_ids,
                "include_moderate": include_moderate,
            }

        except Exception:
            conn.rollback()
            raise

        finally:
            cur.close()
            conn.close()
            
    def create_alerts_for_escalated_cases(self):
        """
        Backfill advisor alerts for intervention cases that are already ESCALATED.
        This does NOT depend on notification.create_in_app_alert().
        """
        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                CREATE EXTENSION IF NOT EXISTS pgcrypto;
                """
            )

            cur.execute(
                """
                WITH selected_run AS (
                    SELECT COALESCE(
                        %s::uuid,
                        (
                            SELECT run_id
                            FROM predictive.model_run
                            WHERE status = 'SUCCESS'
                            ORDER BY finished_at DESC NULLS LAST, started_at DESC
                            LIMIT 1
                        )
                    ) AS run_id
                ),
                alert_targets AS (
                    SELECT DISTINCT
                        sr.run_id,
                        lca.lecturer_number,
                        p.student_number,
                        p.course_code,
                        p.risk_probability,
                        p.predicted_risk_label,
                        CASE p.predicted_risk_label
                            WHEN 'HIGH' THEN 1
                            WHEN 'MODERATE' THEN 2
                            ELSE 3
                        END AS risk_rank
                    FROM selected_run sr
                    JOIN predictive.student_risk_prediction p
                        ON p.run_id = sr.run_id
                    JOIN sakai_raw.lecturer_course_allocation lca
                        ON lca.course_code = p.course_code
                    WHERE sr.run_id IS NOT NULL
                      AND p.student_number IS NOT NULL
                      AND p.course_code IS NOT NULL
                      AND lca.lecturer_number IS NOT NULL
                      AND (
                            p.predicted_at_risk = 1
                            OR p.predicted_risk_label = 'HIGH'
                            OR (%s = TRUE AND p.predicted_risk_label = 'MODERATE')
                      )
                      AND NOT EXISTS (
                            SELECT 1
                            FROM notification.alert existing
                            WHERE existing.recipient_role = 'LECTURER'
                              AND existing.recipient_identifier = lca.lecturer_number
                              AND existing.student_number = p.student_number
                              AND existing.course_code = p.course_code
                              AND existing.alert_type = 'AT_RISK_STUDENT'
                              AND existing.source_module = 'PREDICTIVE'
                              AND existing.status IN ('UNREAD', 'READ')
                      )
                )
                SELECT
                    run_id,
                    lecturer_number,
                    student_number,
                    course_code,
                    risk_probability,
                    predicted_risk_label,
                    risk_rank
                FROM alert_targets
                ORDER BY
                    risk_rank,
                    risk_probability DESC NULLS LAST,
                    lecturer_number,
                    student_number;
                """,
                (str(run_id) if run_id else None, include_moderate),
            )

        except Exception as exc:
            conn.rollback()
            raise exc

        finally:
            cur.close()
            conn.close()

    def get_unread_count(self, recipient_role: str, recipient_identifier: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT COUNT(*) AS unread_count
            FROM notification.alert
            WHERE recipient_role = %s
              AND recipient_identifier = %s
              AND status = 'UNREAD';
            """,
            (str(recipient_role), str(recipient_identifier)),
        )

        row = cur.fetchone()

        cur.close()
        conn.close()

        return row