from typing import Optional
from pydantic import BaseModel, Field


class PredictiveTrainRequest(BaseModel):
    model_name: str = Field(default="Student Risk Random Forest", min_length=1)
    algorithm: str = "RANDOM_FOREST"
    notes: Optional[str] = None


class PredictionStatusUpdate(BaseModel):
    status: str
