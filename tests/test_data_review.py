import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Anomaly

CSV = "tahun,siswa,catatan\n" + "\n".join(f"{2018 + i},{1000 + 50 * i},ok" for i in range(6)) + "\n"


def setup(c):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    with SessionLocal() as db:
        db.add_all([
            Anomaly(dataset_id=did, row_index=2, kolom="siswa", alasan="terlalu tinggi", status="pending"),
            Anomaly(dataset_id=did, row_index=4, kolom="catatan", alasan="format salah", status="ditolak"),
        ])
        db.commit()
    return did


def indexes(r):
    return [x["row_index"] for x in r["data"]]


def test_paging_and_cell_structure():
    with TestClient(app) as c:
        did = setup(c)
        r = c.get(f"/datasets/{did}/datareview?page=1&limit=4").json()
        assert r["total_rows"] == 6 and r["total_pages"] == 2 and r["page"] == 1
        assert indexes(r) == [0, 1, 2, 3] and r["columns"] == ["tahun", "siswa", "catatan"]
        cells = r["data"][2]["cells"]
        assert cells["siswa"]["value"] == 1100
        a = cells["siswa"]["anomaly"]
        assert set(a) == {"id", "jenis", "status", "pesan"}
        assert a["status"] == "pending" and a["pesan"] == "terlalu tinggi"
        assert r["data"][0]["cells"]["siswa"]["anomaly"] is None
        assert indexes(c.get(f"/datasets/{did}/datareview?page=2&limit=4").json()) == [4, 5]


def test_anomaly_status_filter():
    with TestClient(app) as c:
        did = setup(c)

        def rows(status):
            return indexes(c.get(f"/datasets/{did}/datareview?status_anomali={status}").json())

        assert 2 in rows("pending") and 4 not in rows("pending")
        assert 4 in rows("ditolak") and 2 not in rows("ditolak")
        assert {2, 4} <= set(rows("any"))
        r = c.get(f"/datasets/{did}/datareview?status_anomali=salah")
        assert r.status_code == 422 and r.json()["error_code"] == "INVALID_FILTER"


def test_sort_by_column_and_unknown_column():
    with TestClient(app) as c:
        did = setup(c)
        desc = c.get(f"/datasets/{did}/datareview?sort_by=siswa&order=desc").json()
        assert indexes(desc)[0] == 5
        asc = c.get(f"/datasets/{did}/datareview?sort_by=siswa&order=asc").json()
        assert indexes(asc)[0] == 0
        r = c.get(f"/datasets/{did}/datareview?sort_by=xyz")
        assert r.status_code == 422 and r.json()["error_code"] == "INVALID_SORT"


def test_row_index_stays_original_after_apply_review():
    with TestClient(app) as c:
        did = setup(c)
        assert c.post(f"/datasets/{did}/apply-review").status_code == 200
        r = c.get(f"/datasets/{did}/datareview?limit=50").json()
        assert r["version"] == 2 and r["total_rows"] == 5
        assert indexes(r) == [0, 1, 2, 3, 5]


def test_not_cleaned_dataset():
    with TestClient(app) as c:
        did = c.post("/datasets/upload", files={"file": ("e.csv", CSV, "text/csv")}).json()["dataset_id"]
        r = c.get(f"/datasets/{did}/datareview")
        assert r.status_code == 400 and r.json()["error_code"] == "DATASET_NOT_CLEANED"