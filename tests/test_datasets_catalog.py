import io
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pandas as pd
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Anomaly

CSV = "tahun,siswa,catatan\n" + "\n".join(f"{2018 + i},{1000 + 50 * i},ok" for i in range(6)) + "\n"


def upload(c, **data):
    return c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}, data=data).json()["dataset_id"]


def item(c, did):
    return next(x for x in c.get("/datasets").json() if x["id"] == did)


def test_catalog_metadata_after_upload():
    with TestClient(app) as c:
        did = upload(c, instansi_pengelola="Dinas Pendidikan", deskripsi="Data uji")
        d = item(c, did)
        assert d["file_size_bytes"] == len(CSV.encode()) and d["file_size"].endswith("B")
        assert d["sheet_name"] is None and d["instansi_pengelola"] == "Dinas Pendidikan"
        assert d["deskripsi"] == "Data uji" and d["anomali_pending"] == 0
        assert d["dimensi"] == {"total_baris": 6, "total_kolom": 3}
        assert d["uploaded_at"].endswith("Z")


def test_pending_anomalies_and_rows_after_cleaning():
    with TestClient(app) as c:
        did = upload(c)
        c.post(f"/datasets/{did}/clean")
        with SessionLocal() as db:
            db.add_all([Anomaly(dataset_id=did, row_index=i, kolom="siswa", alasan="x", status="pending")
                        for i in range(2)])
            db.commit()
        d = item(c, did)
        assert d["anomali_pending"] == 2 and d["dimensi"]["total_baris"] == 6


def test_excel_sheet_name():
    buf = io.BytesIO()
    pd.DataFrame({"a": [1, 2], "b": [3, 4]}).to_excel(buf, sheet_name="Data2024", index=False)
    with TestClient(app) as c:
        r = c.post("/datasets/upload", files={"file": (
            "d.xlsx", buf.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
        assert r.status_code == 201
        assert item(c, r.json()["dataset_id"])["sheet_name"] == "Data2024"


def test_update_meta_and_unknown_dataset():
    with TestClient(app) as c:
        did = upload(c)
        r = c.patch(f"/datasets/{did}/meta", json={"instansi_pengelola": "BPS", "deskripsi": "Baru"})
        assert r.status_code == 200 and item(c, did)["instansi_pengelola"] == "BPS"
        c.patch(f"/datasets/{did}/meta", json={"deskripsi": None})
        d = item(c, did)
        assert d["deskripsi"] is None and d["instansi_pengelola"] == "BPS"   # field yang tidak dikirim tidak berubah
        assert c.patch("/datasets/999999/meta", json={"deskripsi": "x"}).status_code == 404