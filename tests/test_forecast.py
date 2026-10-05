import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient

from app.forecasting.baseline import next_periods, run_forecast
from app.main import app


def test_next_periods():
    assert next_periods(2023, 2) == [2024, 2025]
    assert next_periods("2023-11", 3) == ["2023-12", "2024-01", "2024-02"]
    assert next_periods("abc", 2) == ["t+1", "t+2"]


def test_linear_series_picks_trend_model():
    r = run_forecast(list(range(2018, 2024)), [10, 20, 30, 40, 50, 60], horizon=2)
    assert r["model_terbaik"] in ("linear_trend", "drift")
    assert r["prediksi"][0]["periode"] == 2024
    assert r["prediksi"][0]["nilai"] == pytest.approx(70, abs=0.01)
    assert r["prediksi"][1]["nilai"] == pytest.approx(80, abs=0.01)
    assert r["evaluasi"][0]["mae"] == pytest.approx(0, abs=0.01)
    assert len(r["perbandingan_uji"]) == r["periode_uji"]


def test_constant_series_and_non_negative_interval():
    r = run_forecast(list(range(2018, 2024)), [5, 5, 5, 5, 5, 5], horizon=1)
    assert r["prediksi"][0]["nilai"] == pytest.approx(5)
    assert r["prediksi"][0]["bawah"] >= 0


def test_too_few_points_and_gap_note():
    with pytest.raises(ValueError):
        run_forecast([2021, 2022, 2023], [1, 2, 3])
    r = run_forecast([2018, 2019, 2021, 2022, 2023], [1, 2, 3, 4, 5])
    assert any("bolong" in c for c in r["catatan"])


def test_api_flow():
    csv = "Tahun,Siswa\n" + "\n".join(f"{2016 + i},{1000 + 50 * i}" for i in range(8)) + "\n"
    with TestClient(app) as c:
        did = c.post("/datasets/upload", files={"file": ("d.csv", csv, "text/csv")}).json()["dataset_id"]
        c.post(f"/datasets/{did}/clean")
        r = c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "horizon": 3})
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["prediksi"]) == 3 and body["prediksi"][0]["periode"] == 2024
        saved = c.get(f"/datasets/{did}/forecast").json()
        assert len(saved) == 3 and saved[0]["indikator"] == "siswa"
        c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "horizon": 2})   # rerun mengganti
        assert len(c.get(f"/datasets/{did}/forecast").json()) == 2
        assert c.post(f"/datasets/{did}/forecast", json={"nilai": "nope"}).status_code == 400
        assert c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa", "agg": "x"}).status_code == 400
        assert c.get("/datasets/9999/forecast").status_code == 404