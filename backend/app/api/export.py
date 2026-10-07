import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, Forecast
from .analysis import load_clean_df
from .reports import get_clean_report, get_dataset_or_404

router = APIRouter(prefix="/datasets/{dataset_id}/export", tags=["export"])

# Sel yang diawali karakter ini bisa dibaca Excel sebagai rumus (formula injection).
DANGEROUS = ("=", "+", "-", "@", "\t", "\r")
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CATATAN_FORECAST = ("Prediksi bukan kepastian. Hasil dihitung dari data historis dengan model "
                    "baseline sederhana dan dapat meleset jika kondisi berubah.")


def _guard(v):
    return "'" + v if isinstance(v, str) and v.startswith(DANGEROUS) else v


def _safe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [_guard(str(c)) for c in df.columns]
    for c in df.columns:
        if pd.api.types.is_object_dtype(df[c]) or pd.api.types.is_string_dtype(df[c]):
            df[c] = df[c].map(_guard)
    return df


def _forecast_df(db: Session, dataset_id: int) -> pd.DataFrame:
    rows = db.scalars(select(Forecast).where(Forecast.dataset_id == dataset_id)
                      .order_by(Forecast.id)).all()
    return pd.DataFrame([{
        "indikator": r.periode.split("|", 1)[0], "periode": r.periode.split("|", 1)[1],
        "nilai_prediksi": r.nilai_prediksi, "model": r.model, "mae": r.mae, "mape": r.mape,
    } for r in rows])


def _autofit(ws):
    for col in ws.columns:
        width = max(len(str(c.value)) if c.value is not None else 0 for c in col)
        ws.column_dimensions[col[0].column_letter].width = min(width + 2, 50)


@router.get("/xlsx")
def export_xlsx(dataset_id: int, db: Session = Depends(get_db)):
    ds = get_dataset_or_404(db, dataset_id)
    df = load_clean_df(db, dataset_id)  # 400 kalau belum di-cleaning
    report = get_clean_report(db, dataset_id) or {}
    anomalies = db.scalars(select(Anomaly).where(Anomaly.dataset_id == dataset_id)
                           .order_by(Anomaly.row_index)).all()
    fc = _forecast_df(db, dataset_id)

    by_status: dict = {}
    for a in anomalies:
        by_status[a.status] = by_status.get(a.status, 0) + 1
    ringkasan = [
        ("Dataset", ds.nama), ("Jenis", ds.jenis), ("Status", ds.status),
        ("Diekspor (UTC)", datetime.utcnow().strftime("%Y-%m-%d %H:%M")),
        ("Baris awal", report.get("baris_awal")), ("Baris akhir", report.get("baris_akhir")),
        ("Duplikat ditemukan", report.get("duplikat_ditemukan")),
        ("Duplikat dihapus", report.get("duplikat_dihapus")),
        ("Kelengkapan data (%)", report.get("kelengkapan_persen")),
        ("Total anomali", len(anomalies)),
        ("Anomali pending", by_status.get("pending", 0)),
        ("Anomali diterima", by_status.get("diterima", 0)),
        ("Anomali ditolak", by_status.get("ditolak", 0)),
    ]
    if not fc.empty:
        ringkasan.append(("Catatan prediksi", CATATAN_FORECAST))

    anomali_df = pd.DataFrame([{
        "baris_di_file_asli": a.row_index + 2,  # +1 header, +1 karena indeks mulai dari 0
        "kolom": a.kolom, "alasan": a.alasan, "status": a.status,
    } for a in anomalies], columns=["baris_di_file_asli", "kolom", "alasan", "status"])

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        _safe(pd.DataFrame(ringkasan, columns=["Keterangan", "Nilai"])).to_excel(
            xw, sheet_name="Ringkasan", index=False)
        _safe(df).to_excel(xw, sheet_name="Data Bersih", index=False)
        _safe(anomali_df).to_excel(xw, sheet_name="Anomali", index=False)
        if not fc.empty:
            _safe(fc).to_excel(xw, sheet_name="Forecast", index=False)
        for ws in xw.book.worksheets:
            _autofit(ws)
    return Response(buf.getvalue(), media_type=XLSX_TYPE, headers={
        "Content-Disposition": f'attachment; filename="laporan_dataset_{dataset_id}.xlsx"'})


@router.get("/forecast.csv")
def export_forecast_csv(dataset_id: int, db: Session = Depends(get_db)):
    get_dataset_or_404(db, dataset_id)
    fc = _forecast_df(db, dataset_id)
    if fc.empty:
        raise HTTPException(404, "Belum ada hasil forecast untuk dataset ini.")
    content = _safe(fc).to_csv(index=False).encode("utf-8-sig")  # utf-8-sig supaya rapi di Excel
    return Response(content, media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="forecast_dataset_{dataset_id}.csv"'})