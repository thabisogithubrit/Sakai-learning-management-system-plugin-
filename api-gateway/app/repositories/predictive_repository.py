from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


def _open_connection():
    try:
        from app.core.db import get_connection  # type: ignore
        return get_connection(), None
    except Exception:
        from app.core.db import get_db_connection  # type: ignore
        context_manager = get_db_connection()
        return context_manager.__enter__(), context_manager


def _close_connection(conn, context_manager=None):
    if context_manager is not None:
        context_manager.__exit__(None, None, None)
        return
    try:
        conn.close()
    except Exception:
        pass


def _serialize(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def _rows_to_dicts(cur):
    columns = [desc[0] for desc in cur.description]
    rows = []
    for row in cur.fetchall():
        if isinstance(row, dict):
            rows.append({key: _serialize(value) for key, value in row.items()})
        else:
            rows.append({key: _serialize(value) for key, value in zip(columns, row)})
    return rows


def _one_to_dict(cur):
    row = cur.fetchone()
    if not row:
        return None
    columns = [desc[0] for desc in cur.description]
    if isinstance(row, dict):
        return {key: _serialize(value) for key, value in row.items()}
    return {key: _serialize(value) for key, value in zip(columns, row)}


class PredictiveRepository:
    def get_training_diagnostics(self):
        conn, context_manager = _open_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM predictive.training_dataset_diagnostics;")
        result = _one_to_dict(cur) or {}
        cur.close()
        _close_connection(conn, context_manager)
        return result

    def get_latest_evaluation(self):
        conn, context_manager = _open_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM predictive.latest_model_evaluation;")
        evaluation = _one_to_dict(cur)

        if not evaluation or not evaluation.get("run_id"):
            cur.close()
            _close_connection(conn, context_manager)
            return {
                "evaluation": None,
                "confusion_matrix": [],
                "feature_importance": [],
            }

        run_id = evaluation["run_id"]

        cur.execute(
            """
            SELECT actual_label, predicted_label, record_count
            FROM predictive.confusion_matrix
            WHERE run_id = %s::uuid
            ORDER BY actual_label, predicted_label;
            """,
            (run_id,),
        )
        confusion = _rows_to_dicts(cur)

        cur.execute(
            """
            SELECT rank, feature_name, importance
            FROM predictive.feature_importance
            WHERE run_id = %s::uuid
            ORDER BY rank ASC;
            """,
            (run_id,),
        )
        features = _rows_to_dicts(cur)

        cur.close()
        _close_connection(conn, context_manager)

        return {
            "evaluation": evaluation,
            "confusion_matrix": confusion,
            "feature_importance": features,
        }

    def get_overview(self):
        conn, context_manager = _open_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM predictive.training_dataset_diagnostics;")
        diagnostics = _one_to_dict(cur) or {}

        cur.execute(
            """
            SELECT *
            FROM predictive.model_run
            ORDER BY finished_at DESC NULLS LAST, started_at DESC
            LIMIT 10;
            """
        )
        model_runs = _rows_to_dicts(cur)

        latest_run_id = model_runs[0]["run_id"] if model_runs else None
        evaluation = None
        confusion = []
        features = []
        predictions = []
        prediction_summary = {
            "total_predictions": 0,
            "high_risk_predictions": 0,
            "moderate_risk_predictions": 0,
            "on_track_predictions": 0,
        }

        if latest_run_id:
            cur.execute("SELECT * FROM predictive.latest_model_evaluation;")
            evaluation = _one_to_dict(cur)

            cur.execute(
                """
                SELECT actual_label, predicted_label, record_count
                FROM predictive.confusion_matrix
                WHERE run_id = %s::uuid
                ORDER BY actual_label, predicted_label;
                """,
                (latest_run_id,),
            )
            confusion = _rows_to_dicts(cur)

            cur.execute(
                """
                SELECT rank, feature_name, importance
                FROM predictive.feature_importance
                WHERE run_id = %s::uuid
                ORDER BY rank ASC
                LIMIT 20;
                """,
                (latest_run_id,),
            )
            features = _rows_to_dicts(cur)

            cur.execute(
                """
                SELECT
                    prediction_id,
                    run_id,
                    student_number,
                    site_id,
                    course_code,
                    risk_probability,
                    predicted_at_risk,
                    predicted_risk_label,
                    model_name,
                    generated_at
                FROM predictive.student_risk_prediction
                WHERE run_id = %s::uuid
                ORDER BY risk_probability DESC NULLS LAST
                LIMIT 100;
                """,
                (latest_run_id,),
            )
            predictions = _rows_to_dicts(cur)

            cur.execute(
                """
                SELECT
                    COUNT(*) AS total_predictions,
                    COUNT(*) FILTER (WHERE predicted_risk_label = 'HIGH') AS high_risk_predictions,
                    COUNT(*) FILTER (WHERE predicted_risk_label = 'MODERATE') AS moderate_risk_predictions,
                    COUNT(*) FILTER (WHERE predicted_risk_label = 'ON_TRACK') AS on_track_predictions
                FROM predictive.student_risk_prediction
                WHERE run_id = %s::uuid;
                """,
                (latest_run_id,),
            )
            prediction_summary = _one_to_dict(cur) or prediction_summary

        cur.close()
        _close_connection(conn, context_manager)

        summary = {
            "training_rows": diagnostics.get("training_rows", 0),
            "at_risk_rows": diagnostics.get("at_risk_rows", 0),
            "not_at_risk_rows": diagnostics.get("not_at_risk_rows", 0),
            "distinct_students": diagnostics.get("distinct_students", 0),
            "distinct_courses": diagnostics.get("distinct_courses", 0),
            "target_meaning": "1 = likely NOT to qualify for exams under the 40% coursework rule",
            "latest_model_status": evaluation.get("status") if evaluation else "NOT_TRAINED",
            "latest_accuracy": evaluation.get("accuracy") if evaluation else None,
            "latest_precision": evaluation.get("precision_score") if evaluation else None,
            "latest_recall": evaluation.get("recall_score") if evaluation else None,
            "latest_f1_score": evaluation.get("f1_score") if evaluation else None,
            "latest_roc_auc": evaluation.get("roc_auc") if evaluation else None,
            "total_predictions": prediction_summary.get("total_predictions", 0),
            "high_risk_predictions": prediction_summary.get("high_risk_predictions", 0),
            "moderate_risk_predictions": prediction_summary.get("moderate_risk_predictions", 0),
            "on_track_predictions": prediction_summary.get("on_track_predictions", 0),
            "last_training_at": evaluation.get("finished_at") if evaluation else None,
        }

        return {
            "summary": summary,
            "training_diagnostics": diagnostics,
            "latest_evaluation": evaluation,
            "model_runs": model_runs,
            "confusion_matrix": confusion,
            "feature_importance": features,
            "predictions": predictions,
        }

    def get_report_ready_testing_table(self):
        conn, context_manager = _open_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                mr.run_id,
                mr.model_name,
                mr.algorithm,
                mr.status,
                mr.training_rows,
                mr.test_rows,
                mr.positive_rows AS at_risk_rows,
                mr.negative_rows AS not_at_risk_rows,
                me.accuracy,
                me.precision_score,
                me.recall_score,
                me.f1_score,
                me.roc_auc,
                mr.finished_at,
                mr.notes
            FROM predictive.model_run mr
            LEFT JOIN predictive.model_evaluation me ON me.run_id = mr.run_id
            ORDER BY mr.finished_at DESC NULLS LAST, mr.started_at DESC
            LIMIT 10;
            """
        )
        rows = _rows_to_dicts(cur)
        cur.close()
        _close_connection(conn, context_manager)
        return {"rows": rows}
