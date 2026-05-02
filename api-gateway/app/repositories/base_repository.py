import pandas as pd
from pathlib import Path

BASE_PATH = Path("C:/SAKAILMSPLUGIN/feature-store-etl/data/curated")

class BaseRepository:

    def load_csv(self, filename: str) -> pd.DataFrame:
        file_path = BASE_PATH / filename

        if not file_path.exists():
            raise FileNotFoundError(f"{filename} not found in {BASE_PATH}")

        return pd.read_csv(file_path)
    