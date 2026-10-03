import io
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app

CSV = "wilayah,tahun,jumlah_siswa\nJakarta,2022,1200\nJakarta,2023,\nBekasi,2022,900\n"


def test_upload_csv_and_preview():
    with TestClient(app) as c:
        r = c.post("/datasets/upload", files={"file": ("siswa.csv", CSV, "text/csv")},
                   data={"jenis": "pendidikan"})
        assert r.status_code == 201
        body = r.json()
        assert body["jumlah_baris"] == 3 and body["jumlah_kolom"] == 3
        kosong = {k["kolom"]: k["kosong"] for k in body["kolom"]}
        assert kosong["jumlah_siswa"] == 1
        assert body["preview"][1]["jumlah_siswa"] is None

        p = c.get(f"/datasets/{body['dataset_id']}/preview")
        assert p.status_code == 200 and p.json()["total_baris"] == 3


def test_upload_semicolon_csv():
    with TestClient(app) as c:
        r = c.post("/datasets/upload", files={"file": ("a.csv", "a;b\n1;2\n3;4\n", "text/csv")})
        assert r.status_code == 201 and r.json()["jumlah_kolom"] == 2


def test_upload_excel():
    buf = io.BytesIO()
    pd.DataFrame({"x": [1, 2], "y": ["a", "b"]}).to_excel(buf, index=False)
    with TestClient(app) as c:
        r = c.post("/datasets/upload", files={"file": ("d.xlsx", buf.getvalue(), "application/octet-stream")})
        assert r.status_code == 201 and r.json()["jumlah_baris"] == 2


def test_reject_bad_format():
    with TestClient(app) as c:
        r = c.post("/datasets/upload", files={"file": ("a.pdf", b"x", "application/pdf")})
        assert r.status_code == 400
