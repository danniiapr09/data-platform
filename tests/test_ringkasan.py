import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import DataEdit, ProcessingLog

CSV = ("wilayah,tahun,siswa,guru\n" + "\n".join(
    f"{w},{t},{'1000' if (w, t) == ('C', 2021) else ('' if (w, t) == ('D', 2020) else '100')},10"
    for w in "ABCDEF" for t in (2020, 2021)) + "\n")


def upload(c, clean=False):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    if clean:
        c.post(f"/datasets/{did}/clean")
    return did


def test_ringkasan_counts():
    with TestClient(app) as c:
        awal = c.get("/ringkasan").json()
        assert set(awal["per_status"]) >= {"uploaded", "cleaned", "forecasted"}

        d1 = upload(c)                       # hanya di-upload
        d2 = upload(c, clean=True)           # sudah di-cleaning (2 anomali pending: 1 outlier + 1 kosong)
        now = c.get("/ringkasan").json()
        assert now["jumlah_dataset"] - awal["jumlah_dataset"] == 2
        assert now["per_status"]["uploaded"] - awal["per_status"]["uploaded"] == 1
        assert now["per_status"]["cleaned"] - awal["per_status"]["cleaned"] == 1
        assert now["anomali_pending"] - awal["anomali_pending"] == 2
        assert now["dataset_dengan_pending"] - awal["dataset_dengan_pending"] == 1
        top = now["pending_teratas"]
        assert len(top) <= 5 and all(set(t) == {"dataset_id", "nama", "pending"} for t in top)
        assert [t["pending"] for t in top] == sorted((t["pending"] for t in top), reverse=True)

        a = c.get(f"/datasets/{d2}/anomalies").json()[0]
        c.patch(f"/anomalies/{a['id']}", json={"status": "diterima"})
        assert c.get("/ringkasan").json()["anomali_pending"] == now["anomali_pending"] - 1
        assert d1 != d2


def test_detail_counts_and_409_flag_agree():
    with TestClient(app) as c:
        did = upload(c, clean=True)
        d = c.get(f"/datasets/{did}").json()
        assert d["jumlah_edit_manual"] == 0 and d["jumlah_review_diterapkan"] == 0
        assert d["cleaning_ulang_butuh_konfirmasi"] is False
        assert c.post(f"/datasets/{did}/clean").status_code == 200           # belum ada yang dilindungi

        with SessionLocal() as db:                                            # simulasi 2 edit manual
            for i in (1, 2):
                db.add(DataEdit(dataset_id=did, versi_baru=2, row_index=i, kolom="siswa",
                                nilai_lama="100", nilai_baru="110", alasan="uji", diubah_oleh="x"))
            db.commit()
        d = c.get(f"/datasets/{did}").json()
        assert d["jumlah_edit_manual"] == 2 and d["cleaning_ulang_butuh_konfirmasi"] is True
        assert c.post(f"/datasets/{did}/clean").status_code == 409            # flag true = 409, sama persis

        assert c.get("/datasets/9999").status_code == 404


def test_detail_counts_review():
    with TestClient(app) as c:
        did = upload(c, clean=True)
        with SessionLocal() as db:                                            # simulasi apply-review sudah dijalankan
            db.add(ProcessingLog(dataset_id=did, langkah="apply_review", ringkasan="uji"))
            db.commit()
        d = c.get(f"/datasets/{did}").json()
        assert d["jumlah_review_diterapkan"] == 1 and d["jumlah_edit_manual"] == 0
        assert d["cleaning_ulang_butuh_konfirmasi"] is True