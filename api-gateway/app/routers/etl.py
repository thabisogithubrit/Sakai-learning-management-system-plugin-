from fastapi import APIRouter, Query
from fastapi import APIRouter, Depends
from app.core.auth import require_roles
from app.schemas.etl import ImportFileCreate, ImportRunCreate
from app.services.etl_service import ETLService

router = APIRouter(
    prefix="/etl",
    tags=["ETL Layer 1"],
    dependencies=[Depends(require_roles("ADMIN"))],
)

etl_service = ETLService()


@router.post("/layer1/refresh")
def refresh_layer1_monitoring():
    return etl_service.refresh_layer1_monitoring()


@router.get("/layer1/overview")
def get_layer1_overview():
    return etl_service.get_layer1_overview()


@router.get("/layer1/table-profiles")
def get_table_profiles():
    return etl_service.get_table_profiles()


@router.get("/layer1/quality-checks")
def get_quality_checks():
    return etl_service.get_quality_checks()


@router.get("/layer1/import-runs")
def get_import_runs(limit: int = Query(default=50, ge=1, le=500)):
    return etl_service.get_import_runs(limit=limit)


@router.post("/layer1/import-runs")
def create_import_run(payload: ImportRunCreate):
    return etl_service.create_import_run(payload)


@router.get("/layer1/import-files")
def get_import_files(run_id: str | None = Query(default=None)):
    return etl_service.get_import_files(run_id=run_id)


@router.post("/layer1/import-files")
def create_import_file(payload: ImportFileCreate):
    return etl_service.create_import_file(payload)


@router.get("/layer1/import-errors")
def get_import_errors(file_id: str | None = Query(default=None)):
    return etl_service.get_import_errors(file_id=file_id)


@router.get("/layer1/expected-files")
def get_expected_files():
    return etl_service.get_expected_files()
