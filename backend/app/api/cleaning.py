import json

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..cleaning.engine import clean, load_rules
from ..config import settings
from ..db import get_db
from ..models import Anomaly, AuditLog, CleanData, Dataset, ProcessingLog, RawData

router = APIRouter(tags=["cleaning"])


@router.post("/datasets/{dataset_id}/clean")
def run_cleaning(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.get(Dataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset tidak ditemukan.")
    raw = db.scalars(select(RawData).where(RawData.dataset_id == dataset_id)
                     .order_by(RawData.row_index)).all()
    if not raw:
        raise HTTPException(400, "Dataset tidak punya data mentah.")

    df = pd.DataFrame([r.row_json for r in raw], index=[r.row_index for r in raw])
    result = clean(df, load_rules(settings.cleaning_rules_path))

    # jalankan ulang = ganti anomali lama, clean_data jadi versi baru
    db.execute(delete(Anomaly).where(Anomaly.dataset_id == dataset_id))
    version = (db.scalar(select(func.max(CleanData.version))
                         .where(CleanData.dataset_id == dataset_id)) or 0) + 1
    records = json.loads(result.df.to_json(orient="records", date_format="iso"))
    db.bulk_insert_mappings(CleanData, [
        {"dataset_id": dataset_id, "version": version, "row_index": int(idx), "row_json": rec}
        for idx, rec in zip(result.df.index, records)
    ])
    db.bulk_insert_mappings(Anomaly, [{"dataset_id": dataset_id, **a} for a in result.anomalies])
    ds.status = "cleaned"
    rp = result.report
    db.add(ProcessingLog(dataset_id=dataset_id, langkah="cleaning",
                         ringkasan=f"v{version}: {rp['baris_awal']}->{rp['baris_akhir']} baris, "
                                   f"{rp['anomali_total']} anomali, kelengkapan {rp['kelengkapan_persen']}%"))
    db.add(AuditLog(aksi=f"cleaning dataset {dataset_id} (v{version})"))
    db.commit()
    return {"dataset_id": dataset_id, "versi": version, "laporan": rp}


@router.get("/datasets/{dataset_id}/anomalies")
def list_anomalies(dataset_id: int, status: str | None = None, db: Session = Depends(get_db)):
    q = select(Anomaly).where(Anomaly.dataset_id == dataset_id).order_by(Anomaly.row_index)
    if status:
        q = q.where(Anomaly.status == status)
    rows = db.scalars(q).all()
    return [{"id": a.id, "row_index": a.row_index, "kolom": a.kolom,
             "alasan": a.alasan, "status": a.status} for a in rows]


class ReviewIn(BaseModel):
    status: str  # diterima = data dianggap valid | ditolak = data dianggap salah


@router.patch("/anomalies/{anomaly_id}")
def review_anomaly(anomaly_id: int, body: ReviewIn, db: Session = Depends(get_db)):
    if body.status not in ("diterima", "ditolak", "pending"):
        raise HTTPException(400, "Status harus: diterima, ditolak, atau pending.")
    a = db.get(Anomaly, anomaly_id)
    if not a:
        raise HTTPException(404, "Anomali tidak ditemukan.")
    a.status = body.status
    db.add(AuditLog(aksi=f"review anomali {anomaly_id} -> {body.status}"))
    db.commit()
    return {"id": a.id, "status": a.status}


@router.get("/datasets/{dataset_id}/clean-preview")
def clean_preview(dataset_id: int, limit: int = 20, db: Session = Depends(get_db)):
    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    if not version:
        raise HTTPException(404, "Dataset belum di-cleaning.")
    rows = db.scalars(select(CleanData).where(CleanData.dataset_id == dataset_id,
                                              CleanData.version == version)
                      .order_by(CleanData.row_index).limit(max(1, min(limit, 200)))).all()
    return {"dataset_id": dataset_id, "versi": version, "preview": [r.row_json for r in rows]}
