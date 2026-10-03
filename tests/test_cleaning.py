import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pandas as pd
from fastapi.testclient import TestClient

from app.cleaning.engine import DEFAULT_RULES, clean
from app.main import app
import copy


def sample():
    return pd.DataFrame({
        "Wilayah ": ["A", "B", "B", "C", "D", "E", "F"],
        "Jumlah": ["10", "11", "11", "12", "10", None, "500"],
        "Catatan": [" ok ", "x", "x", "", "y", "z", "w"],
    })


def test_engine_default_flags_not_deletes():
    r = clean(sample(), copy.deepcopy(DEFAULT_RULES))
    assert list(r.df.columns) == ["wilayah", "jumlah", "catatan"]
    assert r.report["duplikat_dihapus"] == 1           # duplikat memang di-drop
    assert "jumlah" in r.report["kolom_diubah_ke_numerik"]
    jenis = r.report["anomali_per_jenis"]
    assert jenis["outlier"] == 1                        # 500 ditandai
    assert 500 in r.df["jumlah"].values                 # tapi TIDAK dihapus
    assert jenis["kosong"] >= 2                         # jumlah kosong + catatan kosong


def test_engine_fill_median_and_drop_outlier():
    rules = copy.deepcopy(DEFAULT_RULES)
    rules["missing_values"]["strategy"] = "fill_median"
    rules["outliers"]["action"] = "drop"
    r = clean(sample(), rules)
    assert r.df["jumlah"].isna().sum() == 0
    assert 500 not in r.df["jumlah"].values


def test_non_numeric_value_flagged():
    df = pd.DataFrame({"n": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "abc"]})
    r = clean(df, copy.deepcopy(DEFAULT_RULES))
    assert any("bukan angka" in a["alasan"] for a in r.anomalies)


def test_api_flow():
    csv = "wilayah,jumlah\nA,10\nB,11\nB,11\nC,12\nD,10\nE,\nF,500\n"
    with TestClient(app) as c:
        up = c.post("/datasets/upload", files={"file": ("d.csv", csv, "text/csv")}).json()
        did = up["dataset_id"]
        r = c.post(f"/datasets/{did}/clean")
        assert r.status_code == 200
        lap = r.json()["laporan"]
        assert lap["baris_awal"] == 7 and lap["baris_akhir"] == 6
        an = c.get(f"/datasets/{did}/anomalies").json()
        assert len(an) == lap["anomali_total"] > 0
        p = c.patch(f"/anomalies/{an[0]['id']}", json={"status": "diterima"})
        assert p.json()["status"] == "diterima"
        assert c.patch(f"/anomalies/{an[0]['id']}", json={"status": "ngawur"}).status_code == 400
        assert c.get(f"/datasets/{did}/clean-preview").json()["versi"] == 1
        assert c.post(f"/datasets/{did}/clean").json()["versi"] == 2   # rerun = versi baru
        assert c.post("/datasets/9999/clean").status_code == 404
