import pandas as pd
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import AppError
from ..models import ColumnMeta
from .analysis import load_clean_df
from .reports import get_dataset_or_404

router = APIRouter(prefix="/datasets/{dataset_id}/columns", tags=["columns"])

KATA_WAKTU = ("tahun", "year", "bulan", "tanggal", "date", "periode", "waktu")


class DeskripsiBody(BaseModel):
    kolom: str
    deskripsi: str = Field(max_length=1000)


def _native(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v.item() if hasattr(v, "item") else v


def _tipe(s: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(s):
        return "boolean"
    if pd.api.types.is_integer_dtype(s):
        return "integer"
    if pd.api.types.is_numeric_dtype(s):
        return "float"
    if pd.api.types.is_datetime64_any_dtype(s):
        return "datetime"
    return "text"


def _profil(nama: str, s: pd.Series, deskripsi: str | None) -> dict:
    kosong_mask = s.isna()
    if not pd.api.types.is_numeric_dtype(s):
        kosong_mask = kosong_mask | (s.astype(str).str.strip() == "")
    kosong = int(kosong_mask.sum())
    tipe = _tipe(s)
    isi = s[~kosong_mask]
    return {
        "kolom": nama,
        "tipe": tipe,
        "kosong": kosong,
        "persen_kosong": round(kosong / len(s) * 100, 2) if len(s) else 0.0,
        "unik": int(isi.nunique()),
        "contoh": [_native(v) for v in isi.drop_duplicates().head(3).tolist()],
        "deskripsi": deskripsi,
        "is_numeric": tipe in ("integer", "float"),
        "is_time": tipe == "datetime" or any(k in nama.lower() for k in KATA_WAKTU),
    }


@router.get("")
def profil_kolom(dataset_id: int, db: Session = Depends(get_db)):
    get_dataset_or_404(db, dataset_id)
    df = load_clean_df(db, dataset_id)  # 400 kalau belum di-cleaning
    desk = {m.kolom: m.deskripsi for m in db.scalars(
        select(ColumnMeta).where(ColumnMeta.dataset_id == dataset_id)).all()}
    return [_profil(str(c), df[c], desk.get(str(c))) for c in df.columns]


@router.patch("")
def ubah_deskripsi(dataset_id: int, body: DeskripsiBody, db: Session = Depends(get_db)):
    get_dataset_or_404(db, dataset_id)
    df = load_clean_df(db, dataset_id)
    if body.kolom not in [str(c) for c in df.columns]:
        raise AppError(404, "KOLOM_TIDAK_DITEMUKAN", f"Kolom '{body.kolom}' tidak ada di dataset ini.",
                       field="kolom")
    m = db.scalar(select(ColumnMeta).where(ColumnMeta.dataset_id == dataset_id,
                                           ColumnMeta.kolom == body.kolom))
    teks = body.deskripsi.strip()
    if m is None:
        db.add(ColumnMeta(dataset_id=dataset_id, kolom=body.kolom, deskripsi=teks))
    else:
        m.deskripsi = teks
    db.commit()
    return {"kolom": body.kolom, "deskripsi": teks}