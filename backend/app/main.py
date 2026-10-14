import logging
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models  # noqa: F401  (daftarkan semua tabel)
from .api.analysis import router as analysis_router
from .api.anomalies import router as anomalies_router
from .api.cleaning import router as cleaning_router
from .api.compare import router as compare_router
from .api.datasets import router as datasets_router
from .api.edits import router as edits_router
from .api.export import router as export_router
from .api.forecast import router as forecast_router
from .api.reports import router as reports_router
from .db import Base, SessionLocal, engine
from .security import require_api_key

app = FastAPI(title="Platform Data & Forecasting")

# Origin frontend yang boleh memanggil API ini. Ubah lewat env CORS_ORIGINS (pisah dengan koma).
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in origins],
                   allow_methods=["*"], allow_headers=["*"])

# Semua endpoint data dikunci dengan X-API-Key (aktif kalau INTERNAL_API_KEY diisi). /health tetap terbuka.
guard = [Depends(require_api_key)]
for router in (datasets_router, cleaning_router, anomalies_router, edits_router, analysis_router,
               compare_router, forecast_router, reports_router, export_router):
    app.include_router(router, dependencies=guard)


@app.on_event("startup")
def startup():
    # Sementara pakai create_all. Nanti ganti ke Alembic kalau skema sudah stabil.
    Base.metadata.create_all(bind=engine)
    if not os.getenv("INTERNAL_API_KEY"):
        logging.getLogger("uvicorn.error").warning(
            "INTERNAL_API_KEY belum diisi: API terbuka tanpa kunci (hanya untuk development).")


@app.get("/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}