from app.repositories.feature_store_repository import FeatureStoreRepository


class FeatureStoreService:
    def __init__(self):
        self.repo = FeatureStoreRepository()

    def refresh_features(self):
        return self.repo.refresh_features()

    def get_overview(self):
        return self.repo.get_overview()
    
    def get_health(self):
        return self.repo.get_health()
    
    def list_features(
        self,
        risk_level=None,
        course_code=None,
        student_number=None,
        limit=100,
        offset=0,
    ):
        return self.repo.list_features(
            risk_level=risk_level,
            course_code=course_code,
            student_number=student_number,
            limit=limit,
            offset=offset,
        )

    def list_training_dataset(self, limit=100, offset=0):
        return self.repo.list_training_dataset(limit=limit, offset=offset)

    def list_courses(self):
        return self.repo.list_courses()

    def list_feature_catalog(self):
        return self.repo.list_feature_catalog()

    def log_training_export(self, exported_by="SYSTEM", notes=None):
        return self.repo.log_training_export(
            exported_by=exported_by,
            notes=notes,
        )

    def list_refresh_logs(self, limit=20):
        return self.repo.list_refresh_logs(limit=limit)
