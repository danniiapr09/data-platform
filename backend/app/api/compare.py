from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..analysis import compare as cmp
from ..analysis import eda
from ..db import get_db
from .analysis import load_clean_df

router = APIRouter(prefix="/datasets/{dataset_id}", tags=["perbandingan"])


def _prepare(db, dataset_id, waktu, periode=None, dari=None, sampai=None,
             filter_kolom=None, filter_nilai=None):
    df = load_clean_df(db, dataset_id)
    waktu = waktu or eda.detect_time_column(df)
    try:
        sub = cmp.apply_filters(df, waktu, periode, dari, sampai, filter_kolom, filter_nilai)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return sub, waktu, cmp.describe_filters(periode, dari, sampai, filter_kolom, filter_nilai)


@router.get("/compare/options")
def options(dataset_id: int, db: Session = Depends(get_db)):
    """Isi dropdown di UI: kolom angka, kolom pengelompokan, periode, dan pilihan filter."""
    df = load_clean_df(db, dataset_id)
    waktu = eda.detect_time_column(df)
    angka = [c for c in eda.numeric_cols(df) if c != waktu]
    kategori = [c for c in df.columns if c not in eda.numeric_cols(df) and c != waktu]
    periode = []
    if waktu:
        vals = {v for v in cmp._labels(df, waktu).dropna()}
        periode = sorted(vals, key=lambda x: (0, int(x), x) if x.lstrip("-").isdigit() else (1, 0, x))
    return {
        "kolom_waktu": waktu,
        "kolom_angka": angka,
        "kolom_kelompok": kategori + ([waktu] if waktu else []),
        "periode": periode,
        "pilihan_filter": {c: sorted(df[c].dropna().astype(str).str.strip().unique())
                           for c in kategori if df[c].nunique() <= 50},
        "agg": list(eda.AGGS),
    }


@router.get("/compare")
def compare(dataset_id: int, nilai: str, kelompok: str, agg: str = "sum", waktu: str | None = None,
            periode: str | None = None, dari: float | None = None, sampai: float | None = None,
            filter_kolom: str | None = None, filter_nilai: str | None = None,
            urut: str = "desc", top: int | None = None, db: Session = Depends(get_db)):
    sub, waktu, ket = _prepare(db, dataset_id, waktu, periode, dari, sampai, filter_kolom, filter_nilai)
    try:
        return cmp.compare(sub, nilai, kelompok, waktu, agg, urut, top, ket)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/compare/periode")
def compare_periode(dataset_id: int, nilai: str, kelompok: str, periode_a: str, periode_b: str,
                    agg: str = "sum", waktu: str | None = None,
                    filter_kolom: str | None = None, filter_nilai: str | None = None,
                    db: Session = Depends(get_db)):
    sub, waktu, ket = _prepare(db, dataset_id, waktu, None, None, None, filter_kolom, filter_nilai)
    try:
        return cmp.compare_periode(sub, nilai, kelompok, waktu, periode_a, periode_b, agg, ket)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/ratio")
def ratio(dataset_id: int, pembilang: str, penyebut: str, kelompok: str,
          sebagai_persen: bool = False, waktu: str | None = None,
          periode: str | None = None, dari: float | None = None, sampai: float | None = None,
          filter_kolom: str | None = None, filter_nilai: str | None = None,
          urut: str = "desc", top: int | None = None, db: Session = Depends(get_db)):
    sub, waktu, ket = _prepare(db, dataset_id, waktu, periode, dari, sampai, filter_kolom, filter_nilai)
    try:
        return cmp.ratio(sub, pembilang, penyebut, kelompok, waktu, sebagai_persen, urut, top, ket)
    except ValueError as e:
        raise HTTPException(400, str(e))