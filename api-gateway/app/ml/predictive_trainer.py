from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from psycopg2.extras import execute_values
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit, train_test_split

from app.core.db import get_connection


MODEL_NAME = "exam_qualification_random_forest"
ALGORITHM = "RandomForestClassifier"

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLUMNS = [
    "gradebook_score_count",
    "avg_gradebook_percent",
    "min_gradebook_percent",
    "max_gradebook_percent",
    "test_attempt_count",
    "avg_test_percent",
    "min_test_percent",
    "max_test_percent",
    "avg_test_time_seconds",
    "assignment_submission_count",
    "avg_assignment_percent",
    "min_assignment_percent",
    "max_assignment_percent",
    "late_assignment_count",
    "total_assessment_records",
    "scored_assessment_records",
    "avg_assessment_percent",
    "low_score_count",
    "moderate_score_count",
    "good_score_count",
    "missing_score_count",
    "expected_assessment_items",
    "missing_assessment_estimate",
    "days_since_last_assessment",
    "login_count_total",
    "login_days_active",
    "days_since_last_login",
    "resource_action_total",
    "resource_days_active",
    "distinct_resources_accessed",
    "days_since_last_resource",
    "total_activity_count",
]


def _first_value(row: Any) -> Any:
    if not row:
        return None

    if isinstance(row, dict):
        return next(iter(row.values()))

    return row[0]


def _fetch_dataframe(sql: str, params: tuple | None = None) -> pd.DataFrame:
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        return pd.DataFrame(rows, columns=columns)
    finally:
        cur.close()
        conn.close()


def _execute_one(sql: str, params: tuple | None = None) -> Any:
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(sql, params or ())
        row = cur.fetchone()
        conn.commit()
        return _first_value(row)
    finally:
        cur.close()
        conn.close()


def _execute(sql: str, params: tuple | None = None) -> None:
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(sql, params or ())
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _create_model_run(
    total_labelled_rows: int,
    positive_rows: int,
    negative_rows: int,
    target_source_used: str,
) -> str:
    return str(
        _execute_one(
            """
            INSERT INTO predictive.model_run (
                model_name,
                algorithm,
                status,
                training_rows,
                feature_count,
                positive_rows,
                negative_rows,
                notes
            )
            VALUES (
                %s,
                %s,
                'RUNNING',
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING run_id;
            """,
            (
                MODEL_NAME,
                ALGORITHM,
                total_labelled_rows,
                len(FEATURE_COLUMNS),
                positive_rows,
                negative_rows,
                (
                    "Predicts the probability that a student will NOT qualify "
                    "for exams under the NUL 40% coursework rule. "
                    f"Target source used: {target_source_used}."
                ),
            ),
        )
    )


def _mark_model_run_failed(run_id: str, error_message: str) -> None:
    _execute(
        """
        UPDATE predictive.model_run
        SET
            status = 'FAILED',
            finished_at = now(),
            error_message = %s
        WHERE run_id = %s;
        """,
        (error_message, run_id),
    )


def _mark_model_run_success(
    run_id: str,
    model_path: str,
    train_rows: int,
    test_rows: int,
    positive_rows: int,
    negative_rows: int,
    threshold: float,
) -> None:
    _execute(
        """
        UPDATE predictive.model_run
        SET
            status = 'SUCCESS',
            model_path = %s,
            training_rows = %s,
            test_rows = %s,
            positive_rows = %s,
            negative_rows = %s,
            finished_at = now(),
            error_message = NULL,
            notes = COALESCE(notes, '') || %s
        WHERE run_id = %s;
        """,
        (
            model_path,
            train_rows,
            test_rows,
            positive_rows,
            negative_rows,
            f" Selected at-risk decision threshold: {threshold:.2f}.",
            run_id,
        ),
    )


def _save_evaluation(
    run_id: str,
    accuracy: float,
    precision: float,
    recall: float,
    f1: float,
    roc_auc: float | None,
    train_size: int,
    test_size: int,
    positive_test_rows: int,
    negative_test_rows: int,
) -> None:
    _execute(
        """
        INSERT INTO predictive.model_evaluation (
            run_id,
            accuracy,
            precision_score,
            recall_score,
            f1_score,
            roc_auc,
            train_size,
            test_size,
            positive_test_rows,
            negative_test_rows
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (run_id)
        DO UPDATE SET
            accuracy = EXCLUDED.accuracy,
            precision_score = EXCLUDED.precision_score,
            recall_score = EXCLUDED.recall_score,
            f1_score = EXCLUDED.f1_score,
            roc_auc = EXCLUDED.roc_auc,
            train_size = EXCLUDED.train_size,
            test_size = EXCLUDED.test_size,
            positive_test_rows = EXCLUDED.positive_test_rows,
            negative_test_rows = EXCLUDED.negative_test_rows,
            created_at = now();
        """,
        (
            run_id,
            accuracy,
            precision,
            recall,
            f1,
            roc_auc,
            train_size,
            test_size,
            positive_test_rows,
            negative_test_rows,
        ),
    )


def _save_confusion_matrix(run_id: str, y_true, y_pred) -> None:
    matrix = confusion_matrix(y_true, y_pred, labels=[0, 1])

    rows = [
        (run_id, 0, 0, int(matrix[0][0])),
        (run_id, 0, 1, int(matrix[0][1])),
        (run_id, 1, 0, int(matrix[1][0])),
        (run_id, 1, 1, int(matrix[1][1])),
    ]

    conn = get_connection()
    cur = conn.cursor()

    try:
        execute_values(
            cur,
            """
            INSERT INTO predictive.confusion_matrix (
                run_id,
                actual_label,
                predicted_label,
                record_count
            )
            VALUES %s
            ON CONFLICT (run_id, actual_label, predicted_label)
            DO UPDATE SET
                record_count = EXCLUDED.record_count,
                created_at = now();
            """,
            rows,
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _save_feature_importance(run_id: str, model: RandomForestClassifier) -> None:
    importances = list(zip(FEATURE_COLUMNS, model.feature_importances_))
    importances.sort(key=lambda item: item[1], reverse=True)

    rows = [
        (run_id, feature_name, float(importance), rank)
        for rank, (feature_name, importance) in enumerate(importances, start=1)
    ]

    conn = get_connection()
    cur = conn.cursor()

    try:
        execute_values(
            cur,
            """
            INSERT INTO predictive.feature_importance (
                run_id,
                feature_name,
                importance,
                rank
            )
            VALUES %s
            ON CONFLICT (run_id, feature_name)
            DO UPDATE SET
                importance = EXCLUDED.importance,
                rank = EXCLUDED.rank,
                created_at = now();
            """,
            rows,
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _risk_label(probability: float) -> str:
    if probability >= 0.70:
        return "HIGH"

    if probability >= 0.40:
        return "MODERATE"

    return "ON_TRACK"


def _choose_best_threshold(y_true, probabilities) -> tuple[float, dict]:
    """
    Early-warning systems does not only chase accuracy.
    This chooses a threshold that balances F1 and recall for at-risk students.
    """

    best_threshold = 0.50
    best_score = -1.0
    best_metrics = {}

    thresholds = np.arange(0.20, 0.81, 0.05)

    for threshold in thresholds:
        y_pred = (probabilities >= threshold).astype(int)

        precision = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
        recall = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        f1 = f1_score(y_true, y_pred, pos_label=1, zero_division=0)
        accuracy = accuracy_score(y_true, y_pred)


        score = (0.60 * f1) + (0.40 * recall)

        if score > best_score:
            best_score = score
            best_threshold = float(threshold)
            best_metrics = {
                "accuracy": float(accuracy),
                "precision": float(precision),
                "recall": float(recall),
                "f1_score": float(f1),
            }

    return best_threshold, best_metrics


def _save_predictions(
    run_id: str,
    model: RandomForestClassifier,
    decision_threshold: float,
) -> int:
    columns_sql = ", ".join(FEATURE_COLUMNS)

    prediction_df = _fetch_dataframe(
        f"""
        SELECT
            student_number,
            site_id,
            course_code,
            {columns_sql}
        FROM feature_store.model_prediction_input;
        """
    )

    if prediction_df.empty:
        return 0

    X = prediction_df[FEATURE_COLUMNS].apply(pd.to_numeric, errors="coerce")
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    probabilities = model.predict_proba(X)

    if 1 in list(model.classes_):
        positive_index = list(model.classes_).index(1)
        risk_probabilities = probabilities[:, positive_index]
    else:
        risk_probabilities = np.zeros(len(prediction_df))

    rows = []

    for index, row in prediction_df.iterrows():
        probability = float(risk_probabilities[index])
        predicted_at_risk = 1 if probability >= decision_threshold else 0
        label = _risk_label(probability)

        rows.append(
            (
                run_id,
                str(row["student_number"]),
                str(row["site_id"]),
                str(row["course_code"]),
                probability,
                predicted_at_risk,
                label,
                MODEL_NAME,
            )
        )

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            DELETE FROM predictive.student_risk_prediction
            WHERE run_id = %s;
            """,
            (run_id,),
        )

        execute_values(
            cur,
            """
            INSERT INTO predictive.student_risk_prediction (
                run_id,
                student_number,
                site_id,
                course_code,
                risk_probability,
                predicted_at_risk,
                predicted_risk_label,
                model_name
            )
            VALUES %s
            ON CONFLICT (run_id, student_number, site_id)
            DO UPDATE SET
                course_code = EXCLUDED.course_code,
                risk_probability = EXCLUDED.risk_probability,
                predicted_at_risk = EXCLUDED.predicted_at_risk,
                predicted_risk_label = EXCLUDED.predicted_risk_label,
                model_name = EXCLUDED.model_name,
                generated_at = now();
            """,
            rows,
        )

        conn.commit()
        return len(rows)
    finally:
        cur.close()
        conn.close()


def _load_training_data() -> tuple[pd.DataFrame, str]:
    """
    Prefer official 40% labels. Use all labelled rows only if official labels
    are not enough for both classes.
    """

    columns_sql = ", ".join(FEATURE_COLUMNS)

    official_df = _fetch_dataframe(
        f"""
        SELECT
            student_number,
            site_id,
            course_code,
            {columns_sql},
            target_at_risk,
            target_source
        FROM feature_store.model_training_dataset
        WHERE target_at_risk IS NOT NULL
          AND target_source = 'OFFICIAL_COURSEWORK_40PCT_RULE';
        """
    )

    if not official_df.empty:
        official_df["target_at_risk"] = pd.to_numeric(
            official_df["target_at_risk"],
            errors="coerce",
        )
        official_df = official_df[official_df["target_at_risk"].isin([0, 1])].copy()

        positive = int((official_df["target_at_risk"] == 1).sum())
        negative = int((official_df["target_at_risk"] == 0).sum())

        if len(official_df) >= 100 and positive >= 20 and negative >= 20:
            return official_df, "OFFICIAL_COURSEWORK_40PCT_RULE"

    all_df = _fetch_dataframe(
        f"""
        SELECT
            student_number,
            site_id,
            course_code,
            {columns_sql},
            target_at_risk,
            target_source
        FROM feature_store.model_training_dataset
        WHERE target_at_risk IS NOT NULL;
        """
    )

    return all_df, "MIXED_OFFICIAL_AND_DERIVED_40PCT_RULE"


def _split_train_test(X, y, groups):
    """
    Prefer grouped split by student number. This avoids the same student
    appearing in both train and test sets.
    """

    unique_groups = pd.Series(groups).nunique()

    if unique_groups >= 10:
        splitter = GroupShuffleSplit(
            n_splits=1,
            test_size=0.20,
            random_state=42,
        )

        train_index, test_index = next(splitter.split(X, y, groups=groups))

        return (
            X.iloc[train_index],
            X.iloc[test_index],
            y.iloc[train_index],
            y.iloc[test_index],
        )

    stratify = y if y.nunique() == 2 else None

    return train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=stratify,
    )


def train_exam_qualification_model() -> dict:
    df, target_source_used = _load_training_data()

    if df.empty:
        raise ValueError(
            "The model cannot train because feature_store.model_training_dataset is empty."
        )

    df["target_at_risk"] = pd.to_numeric(
        df["target_at_risk"],
        errors="coerce",
    )

    df = df[df["target_at_risk"].isin([0, 1])].copy()
    df["target_at_risk"] = df["target_at_risk"].astype(int)

    positive_rows = int((df["target_at_risk"] == 1).sum())
    negative_rows = int((df["target_at_risk"] == 0).sum())
    total_labelled_rows = int(len(df))

    run_id = _create_model_run(
        total_labelled_rows=total_labelled_rows,
        positive_rows=positive_rows,
        negative_rows=negative_rows,
        target_source_used=target_source_used,
    )

    try:
        if total_labelled_rows == 0:
            raise ValueError(
                "The model cannot train because there are zero labelled rows after cleaning target_at_risk."
            )

        if positive_rows == 0 or negative_rows == 0:
            raise ValueError(
                "The model cannot train because the target labels contain only one class. "
                f"Current counts are NOT_QUALIFY/at_risk={positive_rows}, "
                f"QUALIFY/not_at_risk={negative_rows}. "
                "The training data needs both classes."
            )

        X = df[FEATURE_COLUMNS].apply(pd.to_numeric, errors="coerce")
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

        y = df["target_at_risk"]
        groups = df["student_number"].astype(str)

        X_train, X_test, y_train, y_test = _split_train_test(X, y, groups)

        model = RandomForestClassifier(
            n_estimators=350,
            random_state=42,
            class_weight="balanced_subsample",
            n_jobs=-1,
            min_samples_leaf=2,
            max_features="sqrt",
        )

        model.fit(X_train, y_train)

        probabilities = model.predict_proba(X_test)

        if 1 in list(model.classes_):
            positive_index = list(model.classes_).index(1)
            y_probability = probabilities[:, positive_index]
        else:
            y_probability = np.zeros(len(X_test))

        decision_threshold, threshold_metrics = _choose_best_threshold(
            y_test,
            y_probability,
        )

        y_pred = (y_probability >= decision_threshold).astype(int)

        accuracy = float(accuracy_score(y_test, y_pred))
        precision = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
        recall = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))

        roc_auc = None
        if len(set(y_test)) == 2:
            roc_auc = float(roc_auc_score(y_test, y_probability))

        model_path = MODEL_DIR / f"{MODEL_NAME}_{run_id}.joblib"

        joblib.dump(
            {
                "model": model,
                "feature_columns": FEATURE_COLUMNS,
                "model_name": MODEL_NAME,
                "algorithm": ALGORITHM,
                "decision_threshold": decision_threshold,
                "target_source_used": target_source_used,
                "target_meaning": {
                    "1": "Student is likely NOT to qualify for exams under the 40% coursework rule.",
                    "0": "Student is likely to qualify for exams under the 40% coursework rule.",
                },
            },
            model_path,
        )

        _save_evaluation(
            run_id=run_id,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1=f1,
            roc_auc=roc_auc,
            train_size=int(len(X_train)),
            test_size=int(len(X_test)),
            positive_test_rows=int((y_test == 1).sum()),
            negative_test_rows=int((y_test == 0).sum()),
        )

        _save_confusion_matrix(run_id, y_test, y_pred)
        _save_feature_importance(run_id, model)

        prediction_count = _save_predictions(
            run_id=run_id,
            model=model,
            decision_threshold=decision_threshold,
        )

        _mark_model_run_success(
            run_id=run_id,
            model_path=str(model_path),
            train_rows=int(len(X_train)),
            test_rows=int(len(X_test)),
            positive_rows=positive_rows,
            negative_rows=negative_rows,
            threshold=decision_threshold,
        )

        return {
            "run_id": run_id,
            "model_name": MODEL_NAME,
            "algorithm": ALGORITHM,
            "status": "SUCCESS",
            "target": "NOT_QUALIFY_FOR_EXAM_UNDER_40_PERCENT_RULE",
            "target_source_used": target_source_used,
            "total_labelled_rows": total_labelled_rows,
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "at_risk_rows": positive_rows,
            "not_at_risk_rows": negative_rows,
            "decision_threshold": decision_threshold,
            "prediction_rows_generated": prediction_count,
            "metrics": {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "roc_auc": roc_auc,
            },
            "threshold_selection_metrics": threshold_metrics,
            "model_path": str(model_path),
        }

    except Exception as exc:
        _mark_model_run_failed(run_id, str(exc))
        raise