from typing import Optional
from pydantic import BaseModel


class ImportRunCreate(BaseModel):
    run_name: str
    triggered_by: str = "MANUAL"
    notes: Optional[str] = None


class ImportFileCreate(BaseModel):
    run_id: Optional[str] = None
    file_name: str
    source_path: Optional[str] = None
    source_type: str = "CSV"
    target_schema: str = "sakai_raw"
    target_table: str
    detected_columns: list[str] = []
    expected_columns: list[str] = []
    column_status: str = "NOT_CHECKED"
    status: str = "PENDING"
    rows_detected: int = 0
    rows_loaded: int = 0
    rows_rejected: int = 0
    error_message: Optional[str] = None
