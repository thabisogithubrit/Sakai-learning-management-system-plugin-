import psycopg2
from psycopg2.extras import RealDictCursor


DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 5432,
    "dbname": "AnalyticalDataStore",
    "user": "SakaiLMSPlugin",
    "password": "S@k@i",
}


def get_connection():
    return psycopg2.connect(
        **DB_CONFIG,
        cursor_factory=RealDictCursor,
    )


def get_db_connection():
    return get_connection()