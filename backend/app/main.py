import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models  # noqa: F401  (daftarkan semua tabel)
from .api.analysis import router as analysis_router
from .api.cleaning import router as cleaning_router
from .api.datasets import router as datasets_router
from .api.export import router as export_router
from .api.forecast import router as forecast_router
from .api.reports import router as reports_router
from .db import Base, SessionLocal, engine

app = FastAPI(title="Platform Data & Forecasting")

# Origin frontend yang boleh memanggil API ini. Ubah lewat env CORS_ORIGINS (pisah dengan koma).
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in origins],
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(datasets_router)
app.include_router(cleaning_router)
app.include_router(analysis_router)
app.include_router(forecast_router)
app.include_router(reports_router)
app.include_router(export_router)


@app.on_event("startup")
def create_tables():
    # Sementara pakai create_all. Nanti ganti ke Alembic kalau skema sudah stabil.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}