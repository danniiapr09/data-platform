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
        db.add(Forecast(dataset_id=dataset_id, model=result["model_terbaik"],
                        periode=f"{body.nilai}|{p['periode']}", nilai_prediksi=p["nilai"],
                        mae=best["mae"], mape=best["mape"]))
    db.get(Dataset, dataset_id).status = "forecasted"
    db.add(ProcessingLog(dataset_id=dataset_id, langkah="forecasting",
                         ringkasan=f"{body.nilai}: model {result['model_terbaik']}, "
                                   f"MAE {best['mae']}, horizon {body.horizon}"))
    db.add(AuditLog(aksi=f"forecast dataset {dataset_id} ({body.nilai})"))
    db.commit()
    return {"dataset_id": dataset_id, "indikator": body.nilai, "kolom_waktu": waktu, **result}


@router.get("")
def get_forecast(dataset_id: int, db: Session = Depends(get_db)):
    rows = db.scalars(select(Forecast).where(Forecast.dataset_id == dataset_id)
                      .order_by(Forecast.id)).all()
    if not rows:
        raise HTTPException(404, "Belum ada hasil forecast untuk dataset ini.")
    return [{"indikator": r.periode.split("|", 1)[0], "periode": r.periode.split("|", 1)[1],
             "nilai_prediksi": r.nilai_prediksi, "model": r.model, "mae": r.mae,
             "mape": r.mape, "dibuat": r.created_at.isoformat()} for r in rows]