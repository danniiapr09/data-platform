import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..analysis import eda
from ..db import get_db
from ..models import CleanData, Dataset

router = APIRouter(prefix="/datasets/{dataset_id}/eda", tags=["analysis"])


def load_clean_df(db: Session, dataset_id: int) -> pd.DataFrame:
    if not db.get(Dataset, dataset_id):
        raise HTTPException(404, "Dataset tidak ditemukan.")
    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    if not version:
        raise HTTPException(400, "Dataset belum di-cleaning. Jalankan POST /datasets/{id}/clean dulu.")
    rows = db.scalars(select(CleanData).where(CleanData.dataset_id == dataset_id,
                                              CleanData.version == version)
                      .order_by(CleanData.row_index)).all()
    return pd.DataFrame([r.row_json for r in rows])


@router.get("")
def overview(dataset_id: int, db: Session = Depends(get_db)):
    df = load_clean_df(db, dataset_id)
    waktu = eda.detect_time_column(df)
    return {
        "dataset_id": dataset_id,
        "jumlah_baris": len(df),
        "kolom_waktu": waktu,
        "kandidat_indikator": [c for c in eda.numeric_cols(df) if c != waktu],
        "ringkasan": eda.summarize(df),
        "korelasi": eda.correlations(df),
    }


@router.get("/distribution")
def distribution(dataset_id: int, kolom: str, bins: int = 10, db: Session = Depends(get_db)):
    df = load_clean_df(db, dataset_id)
    try:
        return eda.distribution(df, kolom, bins)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/trend")
def trend(dataset_id: int, nilai: str, waktu: str | None = None, agg: str = "sum",
          group_by: str | None = None, db: Session = Depends(get_db)):
    df = load_clean_df(db, dataset_id)
    waktu = waktu or eda.detect_time_column(df)
    if not waktu:
        raise HTTPException(400, "Kolom waktu tidak terdeteksi. Isi parameter 'waktu'.")
    try:
        return eda.trend(df, waktu, nilai, agg, group_by)
    except ValueError as e:
        raise HTTPException(400, str(e))