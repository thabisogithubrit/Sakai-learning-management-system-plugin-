from pydantic import BaseModel


class FeatureRefreshRequest(BaseModel):
    triggered_by: str = "SYSTEM"
