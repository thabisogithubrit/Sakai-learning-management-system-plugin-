from app.core.db import get_connection


class InterventionRepository:
    def lecturer_teaches_course(self, lecturer_number: str, course_code: str) -> bool:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1
            FROM sakai_raw.lecturer_course_allocation
            WHERE lecturer_number = %s
              AND course_code = %s
            LIMIT 1;
            """,
            (str(lecturer_number), str(course_code)),
        )

        result = cur.fetchone()

        cur.close()
        conn.close()

        return result is not None

    def student_belongs_to_course(self, student_number: str, course_code: str) -> bool:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT 1
            FROM sakai_raw.student_memberships
            WHERE student_number = %s
              AND site_id LIKE %s
            LIMIT 1;
            """,
            (str(student_number), f"{course_code}_%"),
        )

        result = cur.fetchone()

        cur.close()
        conn.close()

        return result is not None

    def create_case(self, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO intervention."case" (
                student_number,
                course_code,
                risk_level,
                reason,
                priority,
                status,
                created_by_role,
                created_by_identifier,
                follow_up_date
            )
            VALUES (
                %s, %s, %s, %s, %s,
                'OPEN',
                %s, %s, %s
            )
            RETURNING *;
            """,
            (
                payload.student_number,
                payload.course_code,
                payload.risk_level,
                payload.reason,
                payload.priority,
                payload.created_by_role,
                payload.created_by_identifier,
                payload.follow_up_date,
            ),
        )

        case_row = cur.fetchone()
        case_id = case_row["case_id"]

        cur.execute(
            """
            INSERT INTO intervention.case_status_history (
                case_id,
                old_status,
                new_status,
                changed_by_role,
                changed_by_identifier,
                change_reason
            )
            VALUES (
                %s,
                NULL,
                'OPEN',
                %s,
                %s,
                'Intervention case created'
            );
            """,
            (
                str(case_id),
                payload.created_by_role,
                payload.created_by_identifier,
            ),
        )

        if payload.note_text:
            cur.execute(
                """
                INSERT INTO intervention.case_note (
                    case_id,
                    note_text,
                    created_by_role,
                    created_by_identifier
                )
                VALUES (%s, %s, %s, %s);
                """,
                (
                    str(case_id),
                    payload.note_text,
                    payload.created_by_role,
                    payload.created_by_identifier,
                ),
            )

        conn.commit()

        cur.close()
        conn.close()

        return case_row

    def list_cases(
        self,
        student_number=None,
        course_code=None,
        status=None,
        created_by_role=None,
        created_by_identifier=None,
    ):
        conn = get_connection()
        cur = conn.cursor()

        filters = []
        values = []

        if student_number:
            filters.append('c.student_number = %s')
            values.append(str(student_number))

        if course_code:
            filters.append('c.course_code = %s')
            values.append(str(course_code))

        if status:
            filters.append('c.status = %s')
            values.append(str(status))

        if created_by_role:
            filters.append('c.created_by_role = %s')
            values.append(str(created_by_role))

        if created_by_identifier:
            filters.append('c.created_by_identifier = %s')
            values.append(str(created_by_identifier))

        where_sql = ""
        if filters:
            where_sql = "WHERE " + " AND ".join(filters)

        cur.execute(
            f"""
            SELECT
                c.*,
                COALESCE(note_counts.note_count, 0) AS note_count
            FROM intervention."case" c
            LEFT JOIN (
                SELECT
                    case_id,
                    COUNT(*) AS note_count
                FROM intervention.case_note
                GROUP BY case_id
            ) note_counts
                ON note_counts.case_id = c.case_id
            {where_sql}
            ORDER BY
                CASE c.priority
                    WHEN 'URGENT' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END,
                c.created_at DESC;
            """,
            values,
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_case(self, case_id: str):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM intervention."case"
            WHERE case_id = %s;
            """,
            (str(case_id),),
        )

        case_row = cur.fetchone()

        if not case_row:
            cur.close()
            conn.close()
            return None

        cur.execute(
            """
            SELECT *
            FROM intervention.case_note
            WHERE case_id = %s
            ORDER BY created_at DESC;
            """,
            (str(case_id),),
        )

        notes = cur.fetchall()

        cur.execute(
            """
            SELECT *
            FROM intervention.case_status_history
            WHERE case_id = %s
            ORDER BY changed_at DESC;
            """,
            (str(case_id),),
        )

        status_history = cur.fetchall()

        cur.execute(
            """
            SELECT *
            FROM intervention.case_outcome
            WHERE case_id = %s;
            """,
            (str(case_id),),
        )

        outcome = cur.fetchone()

        cur.close()
        conn.close()

        case_row["notes"] = notes
        case_row["status_history"] = status_history
        case_row["outcome"] = outcome

        return case_row

    def add_note(self, case_id: str, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO intervention.case_note (
                case_id,
                note_text,
                created_by_role,
                created_by_identifier
            )
            VALUES (%s, %s, %s, %s)
            RETURNING *;
            """,
            (
                str(case_id),
                payload.note_text,
                payload.created_by_role,
                payload.created_by_identifier,
            ),
        )

        row = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return row

    def update_status(self, case_id: str, payload):
        conn = get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                SELECT *
                FROM intervention."case"
                WHERE case_id = %s
                FOR UPDATE;
                """,
                (str(case_id),),
            )

            existing = cur.fetchone()

            if not existing:
                cur.close()
                conn.close()
                return None

            old_status = existing["status"]

            cur.execute(
                """
                UPDATE intervention."case"
                SET status = %s
                WHERE case_id = %s
                RETURNING *;
                """,
                (payload.new_status, str(case_id)),
            )

            case_row = cur.fetchone()

            cur.execute(
                """
                INSERT INTO intervention.case_status_history (
                    case_id,
                    old_status,
                    new_status,
                    changed_by_role,
                    changed_by_identifier,
                    change_reason
                )
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (
                    str(case_id),
                    old_status,
                    payload.new_status,
                    payload.changed_by_role,
                    payload.changed_by_identifier,
                    payload.change_reason,
                ),
            )

            advisor_alert = None

            if payload.new_status == "ESCALATED":
                advisor_alert = self._create_advisor_alert_for_escalated_case(
                    cur=cur,
                    case_row=case_row,
                    changed_by_role=payload.changed_by_role,
                    changed_by_identifier=payload.changed_by_identifier,
                )

            conn.commit()

            cur.close()
            conn.close()

            if advisor_alert is not None:
                case_row["advisor_alert"] = advisor_alert

            return case_row

        except Exception:
            conn.rollback()
            cur.close()
            conn.close()
            raise

    def _create_advisor_alert_for_escalated_case(
        self,
        cur,
        case_row,
        changed_by_role: str,
        changed_by_identifier: str,
    ):
        """
        Create advisor notification when a lecturer escalates an intervention.

        Duplicate protection:
        If an active advisor alert already exists for this case, do not create another one.
        """
        case_id = str(case_row["case_id"])

        cur.execute(
            """
            SELECT *
            FROM notification.alert
            WHERE related_case_id = %s
              AND recipient_role = 'ADVISOR'
              AND alert_type = 'ESCALATED_INTERVENTION'
              AND source_module = 'INTERVENTION'
              AND status IN ('UNREAD', 'READ')
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            (case_id,),
        )

        existing_alert = cur.fetchone()

        if existing_alert:
            existing_alert["was_created_now"] = False
            return existing_alert

        priority = str(case_row.get("priority") or "MEDIUM").upper()
        severity = "CRITICAL" if priority in ("HIGH", "URGENT") else "WARNING"

        student_number = str(case_row.get("student_number") or "")
        course_code = str(case_row.get("course_code") or "")
        reason = str(case_row.get("reason") or "No reason supplied")
        lecturer_number = str(case_row.get("created_by_identifier") or changed_by_identifier)

        title = "Intervention escalated to academic advisor"

        message = (
            f"Lecturer {lecturer_number} escalated intervention case {case_id} "
            f"for student {student_number} in course {course_code}. "
            f"Priority: {priority}. Reason: {reason}. "
            "Please review the case and take advisor action."
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
                "ADVISOR",
                "ACADEMIC_ADVISOR",
                student_number,
                course_code,
                "ESCALATED_INTERVENTION",
                title,
                message,
                severity,
                "INTERVENTION",
                case_id,
                changed_by_role,
                changed_by_identifier,
            ),
        )

        alert_id_row = cur.fetchone()
        alert_id = alert_id_row["alert_id"]

        cur.execute(
            """
            SELECT *
            FROM notification.alert
            WHERE alert_id = %s;
            """,
            (str(alert_id),),
        )

        alert = cur.fetchone()

        if alert:
            alert["was_created_now"] = True

        return alert

    def add_outcome(self, case_id: str, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO intervention.case_outcome (
                case_id,
                outcome_type,
                outcome_summary,
                resolved_by_role,
                resolved_by_identifier
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (case_id)
            DO UPDATE SET
                outcome_type = EXCLUDED.outcome_type,
                outcome_summary = EXCLUDED.outcome_summary,
                resolved_at = now(),
                resolved_by_role = EXCLUDED.resolved_by_role,
                resolved_by_identifier = EXCLUDED.resolved_by_identifier
            RETURNING *;
            """,
            (
                str(case_id),
                payload.outcome_type,
                payload.outcome_summary,
                payload.resolved_by_role,
                payload.resolved_by_identifier,
            ),
        )

        row = cur.fetchone()

        conn.commit()

        cur.close()
        conn.close()

        return row