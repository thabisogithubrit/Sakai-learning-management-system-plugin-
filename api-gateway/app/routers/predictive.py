from fastapi import APIRouter
from fastapi import APIRouter, Depends

from app.core.auth import require_roles
from app.services.predictive_service import PredictiveService

router = APIRouter(
    prefix="/predictive",
    tags=["Predictive Analytics"],
    dependencies=[Depends(require_roles("ADMIN"))],
)

predictive_service = PredictiveService()


@router.get("/diagnostics")
def get_predictive_diagnostics():
    return predictive_service.get_diagnostics()


@router.get("/overview")
def get_predictive_overview():
    return predictive_service.get_overview()


@router.post("/train")
def train_predictive_model():
    return predictive_service.train_model()


@router.get("/evaluation/latest")
def get_latest_model_evaluation():
    return predictive_service.get_latest_evaluation()


@router.get("/report-ready-testing-table")
def get_report_ready_testing_table():
    return predictive_service.get_report_ready_testing_table()


@router.post("/generate-predictions")
def generate_predictions_from_latest_model():
    result = predictive_service.train_model()
    return {
        "message": (
            "Predictions were generated and at-risk alerts were automatically "
            "forwarded to the responsible lecturers."
        ),
        "result": result,
    }