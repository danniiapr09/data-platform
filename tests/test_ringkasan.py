import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Anomaly

CSV = "tahun,siswa,catatan\n" + "\n".join(f"{2018 + i},{1000 + 50 * i},ok" for i in range(6)) + "\n"
KUNCI_BARU = {"total_datasets", "status_counts", "total_anomalies_pending", "rata_rata_kelengkapan",
              "rata_rata_kelengkapan_persen", "last_sync_timestamp", "top_pending_anomalies"}
KUNCI_LAMA = {"jumlah_dataset", "per_status", "anomali_pending", "dataset_dengan_pending", "pending_teratas"}


def buat_dataset(c):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def test_format_baru_dan_kunci_lama_ada_semua():
    with TestClient(app) as c:
        did = buat_dataset(c)
        with SessionLocal() as db:
            db.add_all([Anomaly(dataset_id=did, row_index=i, kolom="siswa", alasan="x", status="pending")
                        for i in range(2)])
            db.commit()
        d = c.get("/ringkasan").json()
        assert KUNCI_BARU | KUNCI_LAMA <= set(d)
        assert sum(d["status_counts"].values()) == d["total_datasets"] == d["jumlah_dataset"]
        assert d["total_anomalies_pending"] == d["anomali_pending"] >= 2
        assert d["last_sync_timestamp"].endswith("Z")


def test_top_anomali_maks_5_dan_terurut():
    with TestClient(app) as c:
        for _ in range(6):
            did = buat_dataset(c)
            with SessionLocal() as db:
                db.add(Anomaly(dataset_id=did, row_index=0, kolom="siswa", alasan="x", status="pending"))
                db.commit()
        top = c.get("/ringkasan").json()["top_pending_anomalies"]
        assert 1 <= len(top) <= 5
        jumlah = [t["pending_count"] for t in top]
        assert jumlah == sorted(jumlah, reverse=True)
        assert set(top[0]) == {"dataset_id", "dataset_nama", "jenis_data", "status", "pending_count", "updated_at"}