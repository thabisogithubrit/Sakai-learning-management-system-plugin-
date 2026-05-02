from fastapi import HTTPException
from app.services.notification_service import NotificationService
from app.core.db import get_connection
from app.ml.predictive_trainer import train_exam_qualification_model


def fetch_all(sql: str, params: tuple | None = None):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(sql, params or ())
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def fetch_one(sql: str, params: tuple | None = None):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(sql, params or ())
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


class PredictiveService:
    def get_diagnostics(self):
        row = fetch_one(
            """
            SELECT
                training_rows,
                at_risk_rows,
                not_at_risk_rows,
                distinct_students,
                distinct_courses,
                example_target_source,
                last_target_source
            FROM predictive.training_dataset_diagnostics;
            """
        )

        return row or {
            "training_rows": 0,
            "at_risk_rows": 0,
            "not_at_risk_rows": 0,
            "distinct_students": 0,
            "distinct_courses": 0,
            "example_target_source": None,
            "last_target_source": None,
        }

    def train_model(self):
        try:
            result = train_exam_qualification_model()

            alert_result = NotificationService().create_at_risk_alerts_for_run(
                run_id=result.get("run_id"),
                include_moderate=True,
            )

            result["lecturer_alerts"] = alert_result

            return result

        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        
    def get_latest_evaluation(self):
        evaluation = fetch_one(
            """
            SELECT *
            FROM predictive.latest_model_evaluation;
            """
        )

        if not evaluation or not evaluation.get("run_id"):
            return {
                "evaluation": None,
                "confusion_matrix": [],
                "feature_importance": [],
            }

        run_id = evaluation["run_id"]

        confusion = fetch_all(
            """
            SELECT
                actual_label,
                predicted_label,
                record_count
            FROM predictive.confusion_matrix
            WHERE run_id = %s
            ORDER BY actual_label, predicted_label;
            """,
            (run_id,),
        )

        features = fetch_all(
            """
            SELECT
                rank,
                feature_name,
                importance
            FROM predictive.feature_importance
            WHERE run_id = %s
            ORDER BY rank ASC
            LIMIT 20;
            """,
            (run_id,),
        )

        return {
            "evaluation": evaluation,
            "confusion_matrix": confusion,
            "feature_importance": features,
        }

    def get_overview(self):
        diagnostics = self.get_diagnostics()
        latest = self.get_latest_evaluation()

        model_runs = fetch_all(
            """
            SELECT
                run_id,
                model_name,
                algorithm,
                status,
                training_rows,
                test_rows,
                feature_count,
                positive_rows,
                negative_rows,
                started_at,
                finished_at,
                error_message
            FROM predictive.model_run
            ORDER BY started_at DESC
            LIMIT 10;
            """
        )

        predictions = fetch_all(
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
            ORDER BY risk_probability DESC NULLS LAST, generated_at DESC
            LIMIT 50;
            """
        )

        feature_importance = latest.get("feature_importance", [])

        prediction_summary = fetch_one(
            """
            SELECT
                COUNT(*) AS total_predictions,
                COUNT(*) FILTER (WHERE predicted_risk_label = 'HIGH') AS high_risk_predictions,
                COUNT(*) FILTER (WHERE predicted_risk_label = 'MODERATE') AS moderate_risk_predictions,
                COUNT(*) FILTER (WHERE predicted_risk_label = 'ON_TRACK') AS on_track_predictions
            FROM predictive.student_risk_prediction
            WHERE run_id = (
                SELECT run_id
                FROM predictive.model_run
                WHERE status = 'SUCCESS'
                ORDER BY finished_at DESC NULLS LAST, started_at DESC
                LIMIT 1
            );
            """
        ) or {}

        evaluation = latest.get("evaluation") or {}

        return {
            "summary": {
                "training_rows": diagnostics.get("training_rows", 0),
                "at_risk_rows": diagnostics.get("at_risk_rows", 0),
                "not_at_risk_rows": diagnostics.get("not_at_risk_rows", 0),
                "distinct_students": diagnostics.get("distinct_students", 0),
                "distinct_courses": diagnostics.get("distinct_courses", 0),
                "latest_model_status": evaluation.get("status", "UNKNOWN"),
                "latest_accuracy": evaluation.get("accuracy"),
                "latest_precision": evaluation.get("precision_score"),
                "latest_recall": evaluation.get("recall_score"),
                "latest_f1_score": evaluation.get("f1_score"),
                "latest_roc_auc": evaluation.get("roc_auc"),
                "total_predictions": prediction_summary.get("total_predictions", 0),
                "high_risk_predictions": prediction_summary.get("high_risk_predictions", 0),
                "moderate_risk_predictions": prediction_summary.get("moderate_risk_predictions", 0),
                "on_track_predictions": prediction_summary.get("on_track_predictions", 0),
                "last_training_at": evaluation.get("finished_at"),
            },
            "diagnostics": diagnostics,
            "evaluation": latest.get("evaluation"),
            "confusion_matrix": latest.get("confusion_matrix", []),
            "feature_importance": feature_importance,
            "model_runs": model_runs,
            "predictions": predictions,
        }

    def get_report_ready_testing_table(self):
        return fetch_all(
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
                me.positive_test_rows,
                me.negative_test_rows,
                mr.started_at,
                mr.finished_at,
                mr.notes
            FROM predictive.model_run mr
            LEFT JOIN predictive.model_evaluation me
                ON me.run_id = mr.run_id
            ORDER BY mr.started_at DESC
            LIMIT 20;
            """
        )