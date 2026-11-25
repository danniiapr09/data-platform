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
        db.add(Anomaly(dataset_id=did, row_index=2, kolom="siswa", alasan="format salah", status="ditolak"))
        db.commit()
    return did


def test_clean_preview_has_row_index_and_total():
    with TestClient(app) as c:
        did = setup(c)
        r = c.get(f"/datasets/{did}/clean-preview?limit=3").json()
        assert r["version"] == 1 and r["total_rows"] == 6 and len(r["rows"]) == 3
        assert [x["row_index"] for x in r["rows"]] == [0, 1, 2]
        assert "preview" in r and "versi" in r            # kompatibel dengan format lama


def test_row_index_stays_original_after_apply_review():
    with TestClient(app) as c:
        did = setup(c)
        assert c.post(f"/datasets/{did}/apply-review").status_code == 200
        r = c.get(f"/datasets/{did}/clean-preview?limit=50").json()
        assert r["version"] == 2 and r["total_rows"] == 5
        assert [x["row_index"] for x in r["rows"]] == [0, 1, 3, 4, 5]   # 2 hilang, indeks TIDAK bergeser


def test_apply_review_preview_returns_rejected_rows():
    with TestClient(app) as c:
        did = setup(c)
        r = c.post(f"/datasets/{did}/apply-review?preview=true").json()
        assert r["status"] == "preview" and r["baris_dibuang"] == 1
        s = r["rejected_rows_sample"][0]
        assert s["row_index"] == 2 and s["siswa"] == 1100 and s["alasan_dibuang"] == "format salah"
        # preview tidak mengubah apa pun
        assert c.get(f"/datasets/{did}/clean-preview").json()["version"] == 1