from fastapi import FastAPI
from sqlalchemy import text

from . import models  # noqa: F401  (daftarkan semua tabel)
from .api.analysis import router as analysis_router
from .api.cleaning import router as cleaning_router
from .api.datasets import router as datasets_router
from .db import Base, SessionLocal, engine

app = FastAPI(title="Platform Data & Forecasting")
app.include_router(datasets_router)
app.include_router(cleaning_router)
app.include_router(analysis_router)


@app.on_event("startup")
def create_tables():
    # Sementara pakai create_all. Nanti ganti ke Alembic kalau skema sudah stabil.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}