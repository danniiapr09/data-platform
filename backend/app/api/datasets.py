import io

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..ingestion.parser import ParseError, profile_columns, read_file, to_records
from ..models import Anomaly, AuditLog, CleanData, Dataset, DatasetMeta, ProcessingLog, RawData

router = APIRouter(prefix="/datasets", tags=["datasets"])


class MetaUpdate(BaseModel):
    instansi_pengelola: str | None = Field(None, max_length=200)
    deskripsi: str | None = Field(None, max_length=1000)


def _clean(text: str | None) -> str | None:
    return (text or "").strip() or None


def _format_size(n: int | None) -> str | None:
    if n is None:
        return None
    if n < 1024:
        return f"{n} B"
    if n < 1024 ** 2:
        return f"{round(n / 1024)} KB"
    return f"{n / 1024 ** 2:.1f} MB"


def _sheet_name(content: bytes, filename: str) -> str | None:
    """Nama sheet pertama untuk file Excel (CSV tidak punya sheet)."""
    if filename.lower().endswith((".xlsx", ".xlsm", ".xls")):
        try:
            return pd.ExcelFile(io.BytesIO(content)).sheet_names[0]
        except Exception:
            return None
    return None


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


@router.post("/upload", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    nama: str | None = Form(None),
    jenis: str = Form("umum"),
    instansi_pengelola: str | None = Form(None),
    deskripsi: str | None = Form(None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        df = read_file(content, file.filename or "")
    except ParseError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ds = Dataset(nama=nama or file.filename, jenis=jenis, status="uploaded")
    db.add(ds)
    db.flush()  # dapatkan ds.id

    db.add(DatasetMeta(
        dataset_id=ds.id,
        file_size_bytes=len(content),
        sheet_name=_sheet_name(content, file.filename or ""),
        instansi_pengelola=_clean(instansi_pengelola),
        deskripsi=_clean(deskripsi),
        total_columns=len(df.columns),
    ))

    records = to_records(df)
    db.bulk_insert_mappings(
        RawData,
        [{"dataset_id": ds.id, "row_index": i, "row_json": r} for i, r in enumerate(records)],
    )
    db.add(ProcessingLog(
        dataset_id=ds.id,
        langkah="upload",
        ringkasan=f"{file.filename}: {len(df)} baris, {len(df.columns)} kolom",
    ))
    db.add(AuditLog(aksi=f"upload dataset {ds.id} ({file.filename})"))
    db.commit()

    return {
        "dataset_id": ds.id,
        "nama": ds.nama,
        "jumlah_baris": len(df),
        "jumlah_kolom": len(df.columns),
        "kolom": profile_columns(df),
        "preview": records[:10],
    }


@router.get("")
def list_datasets(db: Session = Depends(get_db)):
    rows = db.scalars(select(Dataset).order_by(Dataset.uploaded_at.desc())).all()
    meta = {m.dataset_id: m for m in db.scalars(select(DatasetMeta)).all()}

    raw_counts = dict(db.execute(select(RawData.dataset_id, func.count())
                                 .group_by(RawData.dataset_id)).all())
    latest = (select(CleanData.dataset_id, func.max(CleanData.version).label("v"))
              .group_by(CleanData.dataset_id).subquery())
    clean_counts = dict(db.execute(
        select(CleanData.dataset_id, func.count())
        .join(latest, and_(CleanData.dataset_id == latest.c.dataset_id, CleanData.version == latest.c.v))
        .group_by(CleanData.dataset_id)).all())
    pending = dict(db.execute(select(Anomaly.dataset_id, func.count())
                              .where(Anomaly.status == "pending")
                              .group_by(Anomaly.dataset_id)).all())

    out = []
    for d in rows:
        m = meta.get(d.id)
        size = m.file_size_bytes if m else None
        out.append({
            "id": d.id,
            "nama": d.nama,
            "jenis": d.jenis,
            "status": d.status,
            "file_size": _format_size(size),
            "file_size_bytes": size,
            "sheet_name": m.sheet_name if m else None,
            "instansi_pengelola": m.instansi_pengelola if m else None,
            "deskripsi": m.deskripsi if m else None,
            "dimensi": {
                "total_baris": clean_counts.get(d.id, raw_counts.get(d.id, 0)),
                "total_kolom": m.total_columns if m else None,
            },
            "anomali_pending": pending.get(d.id, 0),
            "uploaded_at": _iso(d.uploaded_at),
        })
    return out


@router.patch("/{dataset_id}/meta")
def update_meta(dataset_id: int, body: MetaUpdate, db: Session = Depends(get_db)):
    if not db.get(Dataset, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset tidak ditemukan.")
    m = db.get(DatasetMeta, dataset_id)
    if m is None:
        m = DatasetMeta(dataset_id=dataset_id)
        db.add(m)
    for field in body.model_fields_set:  # hanya field yang dikirim; null = kosongkan
        setattr(m, field, _clean(getattr(body, field)))
    db.commit()
    return {"dataset_id": dataset_id, "instansi_pengelola": m.instansi_pengelola, "deskripsi": m.deskripsi}


@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, limit: int = 20, db: Session = Depends(get_db)):
    ds = db.get(Dataset, dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset tidak ditemukan.")
    limit = max(1, min(limit, 200))
    rows = db.scalars(
        select(RawData).where(RawData.dataset_id == dataset_id)
        .order_by(RawData.row_index).limit(limit)
    ).all()
    total = db.scalar(select(func.count()).select_from(RawData).where(RawData.dataset_id == dataset_id))
    return {"dataset_id": ds.id, "nama": ds.nama, "total_baris": total,
            "preview": [r.row_json for r in rows]}