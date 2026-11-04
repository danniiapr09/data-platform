import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db import SessionLocal
from app.main import app
from app.models import CleanData


def make_csv():
    rows = ["wilayah,tahun,siswa,guru"]
    for w in "ABCDEF":
        for t in (2020, 2021):
            siswa, guru = "100", "10"
            if (w, t) == ("C", 2021):
                siswa = "1000"      # outlier
            if (w, t) == ("D", 2020):
                siswa = ""          # kosong
            if (w, t) == ("E", 2020):
                guru = ""           # kosong
            if (w, t) == ("F", 2021):
                guru = "x"          # bukan angka (+ kosong setelah dikonversi)
            rows.append(f"{w},{t},{siswa},{guru}")
    return "\n".join(rows) + "\n"


def setup(c, csv=None):
    did = c.post("/datasets/upload", files={"file": ("d.csv", csv or make_csv(), "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def tolak(c, did, pilih):
    for a in c.get(f"/datasets/{did}/anomalies").json():
        if pilih(a):
            assert c.patch(f"/anomalies/{a['id']}", json={"status": "ditolak"}).status_code == 200


def n_rows(did, version):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(CleanData)
                         .where(CleanData.dataset_id == did, CleanData.version == version))


def test_preview_then_apply():
    with TestClient(app) as c:
        did = setup(c)
        tolak(c, did, lambda a: a["alasan"].startswith("[outlier]") or a["alasan"].startswith("[format]"))
        u = f"/datasets/{did}/apply-review"

        p = c.post(u, params={"preview": "true"}).json()
        assert p["preview"] is True and p["versi_baru"] is None and p["baris_dibuang"] == 2
        assert c.get(f"/datasets/{did}/clean-preview").json()["versi"] == 1          # preview tidak menulis apa pun

        r = c.post(u, headers={"X-User": "sari@instansi.id"})
        assert r.status_code == 200, r.text
        b = r.json()
        assert (b["versi_lama"], b["versi_baru"]) == (1, 2)
        assert (b["baris_sebelum"], b["baris_dibuang"], b["baris_sesudah"]) == (12, 2, 10)
        assert b["anomali_ditolak_diterapkan"] == 2 and b["diterapkan_oleh"] == "sari@instansi.id"
        assert b["anomali_pending"] == 2                                              # kosong D & E; kosong F ikut terbuang
        assert [d["row_index"] for d in b["detail_baris_dibuang"]] == [5, 11]
        assert b["detail_baris_dibuang"][0]["baris_di_file_asli"] == 7
        assert any("pending" in w for w in b["peringatan"]) and "versi 1 tetap tersimpan" in b["deskripsi"]

        prev = c.get(f"/datasets/{did}/clean-preview", params={"limit": 50}).json()
        assert prev["versi"] == 2 and len(prev["preview"]) == 10
        assert all(row["siswa"] != 1000 for row in prev["preview"])
        assert n_rows(did, 1) == 12 and n_rows(did, 2) == 10                          # versi lama tetap ada

        assert c.post(u).status_code == 400                                           # tidak ada yang perlu diterapkan lagi


def test_errors_and_guards():
    with TestClient(app) as c:
        did = setup(c)
        u = f"/datasets/{did}/apply-review"
        assert c.post(u).status_code == 400                                           # belum ada yang ditolak
        assert c.post("/datasets/9999/apply-review").status_code == 404
        baru = c.post("/datasets/upload", files={"file": ("d.csv", make_csv(), "text/csv")}).json()["dataset_id"]
        assert c.post(f"/datasets/{baru}/apply-review").status_code == 400            # belum di-cleaning

        tolak(c, did, lambda a: True)                                                 # semua ditolak
        assert c.post(u, params={"preview": "true"}).json()["baris_dibuang"] == 4     # 4 baris beranomali (bukan semua baris)
        # dataset yang semua barisnya beranomali
        d2 = setup(c, "a,b\n1,\n2,\n3,\n4,\n")
        tolak(c, d2, lambda a: True)
        assert c.post(f"/datasets/{d2}/apply-review").status_code == 400


def test_reclean_is_guarded_after_apply():
    with TestClient(app) as c:
        did = setup(c)
        tolak(c, did, lambda a: a["alasan"].startswith("[outlier]"))
        assert c.post(f"/datasets/{did}/apply-review").status_code == 200
        assert c.post(f"/datasets/{did}/clean").status_code == 409                    # hasil review tidak hilang diam-diam
        ok = c.post(f"/datasets/{did}/clean", params={"timpa": "true"})
        assert ok.status_code == 200 and ok.json()["versi"] == 3