from importlib import import_module
from app.core.rate_limit import rate_limit_middleware
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import reports

app = FastAPI(title="SSPA API Gateway", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def apply_rate_limit(request, call_next):
    return await rate_limit_middleware(request, call_next)

def include_router_if_available(module_path: str):
    try:
        module = import_module(module_path)
        router = getattr(module, "router")
        app.include_router(router)
    except ModuleNotFoundError:
        return


include_router_if_available("app.routers.health")
include_router_if_available("app.routers.me")
include_router_if_available("app.routers.lecturer")
include_router_if_available("app.routers.student")
include_router_if_available("app.routers.advisor")
include_router_if_available("app.routers.admin")
include_router_if_available("app.routers.intervention")
include_router_if_available("app.routers.notification")
include_router_if_available("app.routers.etl")
include_router_if_available("app.routers.feature_store")
include_router_if_available("app.routers.predictive")
include_router_if_available("app.routers.faculty_admin")
include_router_if_available("app.routers.reports")
app.include_router(reports.router)