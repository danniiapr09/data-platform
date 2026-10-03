from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..ingestion.parser import ParseError, profile_columns, read_file, to_records
from ..models import AuditLog, Dataset, ProcessingLog, RawData

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/upload", status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    nama: str | None = Form(None),
    jenis: str = Form("umum"),
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
    return [
        {"id": d.id, "nama": d.nama, "jenis": d.jenis, "status": d.status,
         "uploaded_at": d.uploaded_at.isoformat()}
        for d in rows
    ]


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
