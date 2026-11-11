import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..analysis import eda
from ..db import get_db
from ..forecasting.baseline import run_forecast
from ..models import AuditLog, Dataset, Forecast, ProcessingLog
from .analysis import load_clean_df

router = APIRouter(prefix="/datasets/{dataset_id}/forecast", tags=["forecasting"])


class ForecastIn(BaseModel):
    nilai: str                       # kolom yang diprediksi, mis. "jumlah_siswa"
    waktu: str | None = None         # kolom waktu; kosong = deteksi otomatis
    agg: str = "sum"                 # sum | mean | median | min | max
    horizon: int = Field(3, ge=1, le=24)
    test_size: int | None = Field(None, ge=1)


def rapikan(r: Forecast) -> tuple:
    """(indikator, periode). Mendukung data lama yang indikatornya masih nempel di periode ('siswa|2025')."""
    if r.indikator is None and "|" in r.periode:
        indikator, periode = r.periode.split("|", 1)
        return indikator, periode
    return r.indikator, r.periode


def _rows(db: Session, dataset_id: int) -> list:
    return db.scalars(select(Forecast).where(Forecast.dataset_id == dataset_id)
                      .order_by(Forecast.id)).all()


@router.post("")
def create_forecast(dataset_id: int, body: ForecastIn, db: Session = Depends(get_db)):
    df = load_clean_df(db, dataset_id)
    waktu = body.waktu or eda.detect_time_column(df)
    if not waktu:
        raise HTTPException(400, "Kolom waktu tidak terdeteksi. Isi field 'waktu'.")
    for c in (waktu, body.nilai):
        if c not in df.columns:
            raise HTTPException(400, f"Kolom '{c}' tidak ada.")
    if body.agg not in eda.AGGS:
        raise HTTPException(400, f"agg harus salah satu dari: {', '.join(eda.AGGS)}")

    series = eda._series(df, waktu, body.nilai, body.agg)
    labels = [eda._label(p) for p in series.index]
    try:
        result = run_forecast(labels, series.values, body.horizon, body.test_size)
    except ValueError as e:
        raise HTTPException(400, str(e))

    best = result["evaluasi"][0]
    # satu hasil forecast aktif per dataset; menjalankan ulang menggantikan yang lama
    db.execute(delete(Forecast).where(Forecast.dataset_id == dataset_id))
    for p in result["prediksi"]:
        db.add(Forecast(dataset_id=dataset_id, indikator=body.nilai, agg=body.agg,
                        model=result["model_terbaik"], periode=str(p["periode"]),
                        nilai_prediksi=p["nilai"], batas_bawah=p["bawah"], batas_atas=p["atas"],
                        mae=best["mae"], mape=best["mape"], rmse=best["rmse"]))
    # bagian yang tidak muat di tabel (evaluasi semua model, aktual vs prediksi, catatan) disimpan sebagai JSON
    detail = {"kolom_waktu": waktu, "horizon": body.horizon,
              **{k: result[k] for k in ("jumlah_periode", "periode_uji", "model_terbaik",
                                        "evaluasi", "perbandingan_uji", "catatan")}}
    db.add(ProcessingLog(dataset_id=dataset_id, langkah="forecast_report",
                         ringkasan=json.dumps(detail, ensure_ascii=False, default=str)))
    db.get(Dataset, dataset_id).status = "forecasted"
    db.add(ProcessingLog(dataset_id=dataset_id, langkah="forecasting",
                         ringkasan=f"{body.nilai} ({body.agg}): model {result['model_terbaik']}, "
                                   f"MAE {best['mae']}, horizon {body.horizon}"))
    db.add(AuditLog(aksi=f"forecast dataset {dataset_id} ({body.nilai}, {body.agg})"[:200]))
    db.commit()
    return {"dataset_id": dataset_id, "indikator": body.nilai, "agg": body.agg,
            "kolom_waktu": waktu, **result}


@router.get("")
def get_forecast(dataset_id: int, db: Session = Depends(get_db)):
    """Hasil forecast yang tersimpan, satu baris per periode (lengkap dengan kisaran dan evaluasi)."""
    rows = _rows(db, dataset_id)
    if not rows:
        raise HTTPException(404, "Belum ada hasil forecast untuk dataset ini.")
    out = []
    for r in rows:
        indikator, periode = rapikan(r)
        out.append({"indikator": indikator, "agg": r.agg, "periode": periode,
                    "nilai_prediksi": r.nilai_prediksi,
                    "batas_bawah": r.batas_bawah, "batas_atas": r.batas_atas,
                    "model": r.model, "mae": r.mae, "mape": r.mape, "rmse": r.rmse,
                    "dibuat": r.created_at.isoformat()})
    return out


@router.get("/laporan")
def get_forecast_report(dataset_id: int, db: Session = Depends(get_db)):
    """Laporan lengkap seperti respons POST: evaluasi semua model, aktual vs prediksi, catatan."""
    rows = _rows(db, dataset_id)
    if not rows:
        raise HTTPException(404, "Belum ada hasil forecast untuk dataset ini.")
    log = db.scalars(select(ProcessingLog).where(ProcessingLog.dataset_id == dataset_id,
                                                 ProcessingLog.langkah == "forecast_report")
                     .order_by(ProcessingLog.id.desc()).limit(1)).first()
    detail = json.loads(log.ringkasan) if log else {}
    indikator = rapikan(rows[0])[0]
    return {
        "dataset_id": dataset_id, "indikator": indikator, "agg": rows[0].agg,
        "dibuat": rows[0].created_at.isoformat(),
        "lengkap": bool(detail),    # false = forecast lama yang dibuat sebelum laporan ikut disimpan
        **detail,
        "prediksi": [{"periode": rapikan(r)[1], "nilai": r.nilai_prediksi,
                      "bawah": r.batas_bawah, "atas": r.batas_atas} for r in rows],
    }