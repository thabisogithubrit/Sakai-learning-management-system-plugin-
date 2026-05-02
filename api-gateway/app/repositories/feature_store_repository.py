from app.core.db import get_connection


class FeatureStoreRepository:

    def get_health(self):
        """
        Lightweight endpoint for the Admin Dashboard readiness card.
        It should not crash just because one view is missing.
        """
        overview = self.get_overview()

        errors = overview.get("errors", [])

        if errors:
            status = "DEGRADED"
        else:
            status = "ONLINE"

        return {
            "module": "Layer 2 Feature Store",
            "status": status,
            "training_rows": overview.get("training_summary", {}).get("training_rows", 0),
            "feature_rows": overview.get("overview", {}).get("feature_rows", 0),
            "errors": errors,
        }
    
    def refresh_features(self):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT feature_store.refresh_student_course_features();")
        conn.commit()
        cur.execute("SELECT * FROM feature_store.latest_refresh_log;")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row

    def get_overview(self):
        conn = get_connection()
        cur = conn.cursor()

        errors = []

        def fetchone_or_empty(sql: str, name: str):
            try:
                cur.execute(sql)
                return cur.fetchone() or {}
            except Exception as exc:
                conn.rollback()
                errors.append({
                    "section": name,
                    "error": str(exc),
                })
                return {}

        def fetchall_or_empty(sql: str, name: str):
            try:
                cur.execute(sql)
                return cur.fetchall()
            except Exception as exc:
                conn.rollback()
                errors.append({
                    "section": name,
                    "error": str(exc),
                })
                return []

        def count_table(table_name: str, label: str):
            try:
                cur.execute("SELECT to_regclass(%s) AS table_ref;", (table_name,))
                table_ref = cur.fetchone()

                if not table_ref or not table_ref.get("table_ref"):
                    errors.append({
                        "section": label,
                        "error": f"{table_name} does not exist",
                    })
                    return 0

                cur.execute(f"SELECT COUNT(*) AS row_count FROM {table_name};")
                row = cur.fetchone() or {}
                return row.get("row_count", 0)

            except Exception as exc:
                conn.rollback()
                errors.append({
                    "section": label,
                    "error": str(exc),
                })
                return 0

        overview = fetchone_or_empty(
            "SELECT * FROM feature_store.feature_layer_overview;",
            "feature_layer_overview",
        )

        risk_distribution = fetchall_or_empty(
            "SELECT * FROM feature_store.risk_distribution;",
            "risk_distribution",
        )

        training_summary = fetchone_or_empty(
            "SELECT * FROM feature_store.training_dataset_summary;",
            "training_dataset_summary",
        )

        quality_summary = fetchall_or_empty(
            "SELECT * FROM feature_store.data_quality_summary;",
            "data_quality_summary",
        )

        course_summary = fetchall_or_empty(
            "SELECT * FROM feature_store.course_feature_summary LIMIT 20;",
            "course_feature_summary",
        )

        latest_refresh = fetchone_or_empty(
            "SELECT * FROM feature_store.latest_refresh_log;",
            "latest_refresh_log",
        )

        feature_rows = count_table(
            "feature_store.student_course_features",
            "student_course_features",
        )

        training_rows = count_table(
            "feature_store.model_training_dataset",
            "model_training_dataset",
        )

        if not overview:
            overview = {
                "feature_rows": feature_rows,
                "training_rows": training_rows,
            }

        if not training_summary:
            training_summary = {
                "training_rows": training_rows,
            }

        cur.close()
        conn.close()

        return {
            "overview": overview,
            "risk_distribution": risk_distribution,
            "training_summary": training_summary,
            "quality_summary": quality_summary,
            "course_summary": course_summary,
            "latest_refresh": latest_refresh,
            "errors": errors,
        }
    
    
    def list_training_dataset(self, limit=100, offset=0):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT COUNT(*) AS total_count
            FROM feature_store.model_training_dataset;
            """
        )
        count_row = cur.fetchone()

        cur.execute(
            """
            SELECT *
            FROM feature_store.model_training_dataset
            ORDER BY course_code, student_number
            LIMIT %s OFFSET %s;
            """,
            (int(limit), int(offset)),
        )
        rows = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "total_count": count_row.get("total_count", 0) if count_row else 0,
            "limit": int(limit),
            "offset": int(offset),
            "rows": rows,
        }

    def list_courses(self):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM feature_store.course_feature_summary;")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def list_feature_catalog(self):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT *
            FROM feature_store.feature_catalog
            ORDER BY feature_group, feature_name;
            """
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows

    def log_training_export(self, exported_by="SYSTEM", notes=None):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT feature_store.log_training_export(%s, %s) AS export_id;
            """,
            (exported_by, notes),
        )
        row = cur.fetchone()
        conn.commit()

        cur.execute(
            """
            SELECT *
            FROM feature_store.training_export_log
            WHERE export_id = %s;
            """,
            (str(row["export_id"]),),
        )
        export_row = cur.fetchone()

        cur.close()
        conn.close()
        return export_row

    def list_refresh_logs(self, limit=20):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT *
            FROM feature_store.feature_refresh_log
            ORDER BY started_at DESC
            LIMIT %s;
            """,
            (int(limit),),
        )
        rows = cur.fetchall()

        cur.close()
        conn.close()
        return rows
