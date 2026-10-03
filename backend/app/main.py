from fastapi import FastAPI
from sqlalchemy import text

from . import models  # noqa: F401  (daftarkan semua tabel)
from .db import Base, SessionLocal, engine

app = FastAPI(title="Platform Data & Forecasting")


@app.on_event("startup")
def create_tables():
    # Sementara pakai create_all. Nanti ganti ke Alembic kalau skema sudah stabil.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
