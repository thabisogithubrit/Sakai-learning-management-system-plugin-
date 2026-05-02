import json

from app.core.db import get_connection


class ETLRepository:
    def refresh_layer1_monitoring(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT etl.refresh_layer1_monitoring();")
        conn.commit()

        cur.close()
        conn.close()

        return self.get_layer1_overview()

    def get_layer1_overview(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM etl.layer1_overview;")
        summary = cur.fetchone() or {}

        cur.execute(
            """
            SELECT *
            FROM etl.raw_table_profile
            ORDER BY
                CASE status
                    WHEN 'COLUMN_MISMATCH' THEN 1
                    WHEN 'MISSING_TABLE' THEN 2
                    WHEN 'EMPTY' THEN 3
                    WHEN 'READY' THEN 4
                    ELSE 5
                END,
                table_name;
            """
        )
        table_profiles = cur.fetchall()

        cur.execute(
            """
            SELECT *
            FROM etl.data_quality_check
            ORDER BY
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'ERROR' THEN 2
                    WHEN 'WARNING' THEN 3
                    WHEN 'INFO' THEN 4
                    ELSE 5
                END,
                affected_table,
                check_name;
            """
        )
        quality_checks = cur.fetchall()

        cur.execute(
            """
            SELECT *
            FROM etl.import_run
            ORDER BY started_at DESC
            LIMIT 10;
            """
        )
        recent_runs = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "summary": summary,
            "table_profiles": table_profiles,
            "quality_checks": quality_checks,
            "recent_runs": recent_runs,
        }

    def get_table_profiles(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM etl.raw_table_profile
            ORDER BY table_name;
            """
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_quality_checks(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM etl.data_quality_check
            ORDER BY
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'ERROR' THEN 2
                    WHEN 'WARNING' THEN 3
                    WHEN 'INFO' THEN 4
                    ELSE 5
                END,
                affected_table,
                check_name;
            """
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_import_runs(self, limit: int = 50):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM etl.import_run
            ORDER BY started_at DESC
            LIMIT %s;
            """,
            (limit,),
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_import_files(self, run_id: str | None = None):
        conn = get_connection()
        cur = conn.cursor()

        if run_id:
            cur.execute(
                """
                SELECT *
                FROM etl.import_file
                WHERE run_id = %s
                ORDER BY started_at DESC;
                """,
                (str(run_id),),
            )
        else:
            cur.execute(
                """
                SELECT *
                FROM etl.import_file
                ORDER BY started_at DESC
                LIMIT 100;
                """
            )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_import_errors(self, file_id: str | None = None):
        conn = get_connection()
        cur = conn.cursor()

        if file_id:
            cur.execute(
                """
                SELECT *
                FROM etl.import_error
                WHERE file_id = %s
                ORDER BY created_at DESC;
                """,
                (str(file_id),),
            )
        else:
            cur.execute(
                """
                SELECT *
                FROM etl.import_error
                ORDER BY created_at DESC
                LIMIT 200;
                """
            )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def get_expected_files(self):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM etl.expected_raw_file
            ORDER BY file_name;
            """
        )

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return rows

    def create_import_run(self, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO etl.import_run (
                run_name,
                status,
                triggered_by,
                notes
            )
            VALUES (%s, 'PENDING', %s, %s)
            RETURNING *;
            """,
            (
                payload.run_name,
                payload.triggered_by,
                payload.notes,
            ),
        )

        row = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        return row

    def create_import_file(self, payload):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO etl.import_file (
                run_id,
                file_name,
                source_path,
                source_type,
                target_schema,
                target_table,
                detected_columns,
                expected_columns,
                column_status,
                status,
                rows_detected,
                rows_loaded,
                rows_rejected,
                error_message
            )
            VALUES (
                %s, %s, %s, %s, %s, %s,
                %s::jsonb, %s::jsonb,
                %s, %s, %s, %s, %s, %s
            )
            RETURNING *;
            """,
            (
                payload.run_id,
                payload.file_name,
                payload.source_path,
                payload.source_type,
                payload.target_schema,
                payload.target_table,
                json.dumps(payload.detected_columns),
                json.dumps(payload.expected_columns),
                payload.column_status,
                payload.status,
                payload.rows_detected,
                payload.rows_loaded,
                payload.rows_rejected,
                payload.error_message,
            ),
        )

        row = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        return row
