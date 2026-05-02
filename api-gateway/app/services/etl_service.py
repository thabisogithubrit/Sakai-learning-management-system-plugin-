from app.repositories.etl_repository import ETLRepository


class ETLService:
    def __init__(self):
        self.repo = ETLRepository()

    def refresh_layer1_monitoring(self):
        return self.repo.refresh_layer1_monitoring()

    def get_layer1_overview(self):
        return self.repo.get_layer1_overview()

    def get_table_profiles(self):
        return self.repo.get_table_profiles()

    def get_quality_checks(self):
        return self.repo.get_quality_checks()

    def get_import_runs(self, limit: int = 50):
        return self.repo.get_import_runs(limit=limit)

    def get_import_files(self, run_id: str | None = None):
        return self.repo.get_import_files(run_id=run_id)

    def get_import_errors(self, file_id: str | None = None):
        return self.repo.get_import_errors(file_id=file_id)

    def get_expected_files(self):
        return self.repo.get_expected_files()

    def create_import_run(self, payload):
        return self.repo.create_import_run(payload)

    def create_import_file(self, payload):
        return self.repo.create_import_file(payload)
