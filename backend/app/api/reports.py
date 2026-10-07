import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, CleanData, Dataset, Forecast, ProcessingLog, RawData

router = APIRouter(prefix="/datasets/{dataset_id}", tags=["reports"])


def get_dataset_or_404(db: Session, dataset_id: int) -> Dataset:
    ds = db.get(Dataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset tidak ditemukan.")
    return ds


def get_clean_report(db: Session, dataset_id: int) -> dict | None:
    """Laporan kualitas dari cleaning terakhir (disimpan sebagai JSON di processing_log)."""
    row = db.scalars(
        select(ProcessingLog)
        .where(ProcessingLog.dataset_id == dataset_id, ProcessingLog.langkah == "cleaning_report")
        .order_by(ProcessingLog.id.desc()).limit(1)
    ).first()
    return json.loads(row.ringkasan) if row else None


@router.get("")
def dataset_detail(dataset_id: int, db: Session = Depends(get_db)):
    ds = get_dataset_or_404(db, dataset_id)
    raw_count = db.scalar(select(func.count()).select_from(RawData)
                          .where(RawData.dataset_id == dataset_id))
    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    clean_count = 0
    if version:
        clean_count = db.scalar(select(func.count()).select_from(CleanData)
                                .where(CleanData.dataset_id == dataset_id,
                                       CleanData.version == version))
    status_rows = db.execute(select(Anomaly.status, func.count()).where(Anomaly.dataset_id == dataset_id)
                             .group_by(Anomaly.status)).all()
    forecast_count = db.scalar(select(func.count()).select_from(Forecast)
                               .where(Forecast.dataset_id == dataset_id))
    return {
        "id": ds.id, "nama": ds.nama, "jenis": ds.jenis, "status": ds.status,
        "uploaded_at": ds.uploaded_at.isoformat(),
        "baris_mentah": raw_count,
        "versi_bersih": version, "baris_bersih": clean_count,
        "anomali": {s: n for s, n in status_rows},
        "ada_forecast": forecast_count > 0,
    }


@router.get("/clean-report")
def clean_report(dataset_id: int, db: Session = Depends(get_db)):
    get_dataset_or_404(db, dataset_id)
    report = get_clean_report(db, dataset_id)
    if not report:
        raise HTTPException(404, "Belum ada laporan. Jalankan cleaning dulu.")
    return report


@router.get("/history")
def history(dataset_id: int, db: Session = Depends(get_db)):
    get_dataset_or_404(db, dataset_id)
    rows = db.scalars(select(ProcessingLog)
                      .where(ProcessingLog.dataset_id == dataset_id,
                             ProcessingLog.langkah != "cleaning_report")
                      .order_by(ProcessingLog.id)).all()
    return [{"langkah": r.langkah, "ringkasan": r.ringkasan, "waktu": r.waktu.isoformat()}
            for r in rows]