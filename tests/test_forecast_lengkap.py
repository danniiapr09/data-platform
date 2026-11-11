import io
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.db import SessionLocal
from app.main import app
from app.models import Forecast

# tren naik dengan sedikit gelombang, supaya kesalahan model tidak persis nol
CSV = "Tahun,Siswa\n" + "\n".join(f"{2016 + i},{1000 + 50 * i + (30 if i % 2 else 0)}" for i in range(8)) + "\n"


def setup(c):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def test_get_forecast_is_complete():
    with TestClient(app) as c:
        did = setup(c)
        post = c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "horizon": 3})
        assert post.status_code == 200, post.text
        best = post.json()["evaluasi"][0]
        rows = c.get(f"/datasets/{did}/forecast").json()
        assert len(rows) == 3
        r = rows[0]
        assert r["indikator"] == "siswa" and r["agg"] == "sum" and r["periode"] == "2024"   # tanpa awalan indikator
        assert r["batas_bawah"] is not None and r["batas_atas"] is not None
        assert r["batas_bawah"] <= r["nilai_prediksi"] <= r["batas_atas"]
        assert (r["mae"], r["mape"], r["rmse"]) == (best["mae"], best["mape"], best["rmse"])
        assert r["rmse"] > 0 and r["batas_bawah"] < r["batas_atas"]


def test_agg_is_saved_and_report_survives_reopen():
    with TestClient(app) as c:
        did = setup(c)
        c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "agg": "mean", "horizon": 2})
        assert {r["agg"] for r in c.get(f"/datasets/{did}/forecast").json()} == {"mean"}
        lap = c.get(f"/datasets/{did}/forecast/laporan").json()
        assert lap["lengkap"] is True and lap["agg"] == "mean" and lap["indikator"] == "siswa"
        assert len(lap["evaluasi"]) == 4 and lap["model_terbaik"] == lap["evaluasi"][0]["model"]
        assert lap["perbandingan_uji"] and lap["catatan"] and lap["kolom_waktu"] == "tahun"
        assert len(lap["prediksi"]) == 2 and lap["prediksi"][0]["bawah"] is not None


def test_rerun_replaces_and_history_stays_clean():
    with TestClient(app) as c:
        did = setup(c)
        c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "horizon": 3})
        c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "horizon": 2})
        assert len(c.get(f"/datasets/{did}/forecast").json()) == 2
        langkah = [x["langkah"] for x in c.get(f"/datasets/{did}/history").json()]
        assert "forecasting" in langkah and "forecast_report" not in langkah and "cleaning_report" not in langkah
        assert c.get(f"/datasets/{did}/forecast/laporan").json()["horizon"] == 2          # laporan terbaru yang dipakai


def test_export_uses_new_columns():
    with TestClient(app) as c:
        did = setup(c)
        c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "horizon": 3})
        wb = load_workbook(io.BytesIO(c.get(f"/datasets/{did}/export/xlsx").content))
        header = [cell.value for cell in wb["Forecast"][1]]
        assert header[:3] == ["indikator", "agg", "periode"] and {"batas_bawah", "batas_atas", "rmse"} <= set(header)
        assert wb["Forecast"].max_row == 4
        csv = c.get(f"/datasets/{did}/export/forecast.csv").content.decode("utf-8-sig")
        assert csv.splitlines()[0].startswith("indikator,agg,periode") and len(csv.strip().splitlines()) == 4


def test_legacy_rows_still_work():
    """Forecast lama: indikator masih nempel di periode, agg dan kisaran belum tersimpan."""
    with TestClient(app) as c:
        did = setup(c)
        with SessionLocal() as db:
            db.add(Forecast(dataset_id=did, indikator=None, agg=None, model="drift",
                            periode="siswa|2030", nilai_prediksi=123.0, mae=1.0, mape=2.0))
            db.commit()
        r = c.get(f"/datasets/{did}/forecast").json()[0]
        assert (r["indikator"], r["periode"], r["agg"], r["batas_bawah"]) == ("siswa", "2030", None, None)
        lap = c.get(f"/datasets/{did}/forecast/laporan").json()
        assert lap["lengkap"] is False and lap["prediksi"][0]["periode"] == "2030"
        assert c.get(f"/datasets/{did}/export/forecast.csv").status_code == 200           # export tidak error


def test_404_without_forecast():
    with TestClient(app) as c:
        did = setup(c)
        assert c.get(f"/datasets/{did}/forecast").status_code == 404
        assert c.get(f"/datasets/{did}/forecast/laporan").status_code == 404