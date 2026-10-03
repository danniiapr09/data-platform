import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis import eda
from app.main import app


def df():
    return pd.DataFrame({
        "wilayah": ["A", "A", "A", "B", "B", "B"],
        "tahun": [2021, 2022, 2023, 2021, 2022, 2023],
        "siswa": [100, 110, 121, 50, 50, 50],
        "guru": [10, 11, 12, 5, 5, 5],
    })


def test_detect_and_summary():
    d = df()
    assert eda.detect_time_column(d) == "tahun"
    s = eda.summarize(d)
    assert s["numerik"]["siswa"]["max"] == 121
    assert s["kategorikal"]["wilayah"]["unik"] == 2


def test_trend_total_and_group():
    t = eda.trend(df(), "tahun", "siswa", "sum", "wilayah")
    assert t["total"]["arah"] == "naik"
    assert t["total"]["titik"][1]["pertumbuhan_persen"] == pytest.approx(6.67, abs=0.01)
    assert t["per_kelompok"]["A"]["arah"] == "naik"
    assert t["per_kelompok"]["B"]["arah"] == "stabil"


def test_distribution_and_corr():
    d = eda.distribution(df(), "siswa", 4)
    assert sum(b["jumlah"] for b in d["bins"]) == 6
    c = eda.correlations(df())
    assert c["pasangan_teratas"][0]["korelasi"] > 0.9
    with pytest.raises(ValueError):
        eda.distribution(df(), "tidak_ada")


def test_api_flow():
    csv = "Wilayah,Tahun,Siswa\nA,2021,100\nA,2022,110\nA,2023,121\nB,2021,50\nB,2022,50\nB,2023,50\n"
    with TestClient(app) as c:
        did = c.post("/datasets/upload", files={"file": ("d.csv", csv, "text/csv")}).json()["dataset_id"]
        assert c.get(f"/datasets/{did}/eda").status_code == 400      # belum cleaning
        c.post(f"/datasets/{did}/clean")
        ov = c.get(f"/datasets/{did}/eda").json()
        assert ov["kolom_waktu"] == "tahun" and ov["kandidat_indikator"] == ["siswa"]
        tr = c.get(f"/datasets/{did}/eda/trend", params={"nilai": "siswa", "group_by": "wilayah"}).json()
        assert tr["total"]["arah"] == "naik"
        assert c.get(f"/datasets/{did}/eda/distribution", params={"kolom": "siswa"}).status_code == 200
        assert c.get(f"/datasets/{did}/eda/trend", params={"nilai": "x"}).status_code == 400