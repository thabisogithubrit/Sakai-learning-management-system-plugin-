from fastapi import APIRouter, Query
from fastapi import APIRouter, Depends

from app.core.auth import require_roles
from app.schemas.feature_store import FeatureRefreshRequest
from app.services.feature_store_service import FeatureStoreService

router = APIRouter(
    prefix="/feature-store",
    tags=["Feature Store ETL"],
    dependencies=[Depends(require_roles("ADMIN"))],
)

feature_store_service = FeatureStoreService()

@router.get("/health")
def get_feature_store_health():
    return feature_store_service.get_health()

@router.get("/overview")
def get_feature_store_overview():
    return feature_store_service.get_overview()


@router.post("/refresh")
def refresh_feature_store(payload: FeatureRefreshRequest | None = None):
    return feature_store_service.refresh_features()


@router.get("/features")
def list_student_course_features(
    risk_level: str | None = Query(default=None),
    course_code: str | None = Query(default=None),
    student_number: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return feature_store_service.list_features(
        risk_level=risk_level,
        course_code=course_code,
        student_number=student_number,
        limit=limit,
        offset=offset,
    )


@router.get("/training-dataset")
def list_training_dataset(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return feature_store_service.list_training_dataset(
        limit=limit,
        offset=offset,
    )


@router.get("/courses")
def list_feature_store_courses():
    return feature_store_service.list_courses()


@router.get("/catalog")
def list_feature_catalog():
    return feature_store_service.list_feature_catalog()


@router.post("/training-export-log")
def log_training_export(
    exported_by: str = Query(default="SYSTEM"),
    notes: str | None = Query(default=None),
):
    return feature_store_service.log_training_export(
        exported_by=exported_by,
        notes=notes,
    )


@router.get("/refresh-logs")
def list_refresh_logs(limit: int = Query(default=20, ge=1, le=100)):
    return feature_store_service.list_refresh_logs(limit=limit)
