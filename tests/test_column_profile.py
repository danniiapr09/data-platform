import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.main import app

CSV = "tahun,siswa,catatan\n" + "\n".join(f"{2018 + i},{1000 + 50 * i},ok" for i in range(6)) + "\n"
KUNCI = {"kolom", "tipe", "kosong", "persen_kosong", "unik", "contoh", "deskripsi", "is_numeric", "is_time"}


def setup(c):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def test_profil_semua_kolom():
    with TestClient(app) as c:
        did = setup(c)
        r = c.get(f"/datasets/{did}/columns")
        assert r.status_code == 200
        p = {x["kolom"]: x for x in r.json()}
        assert list(p) == ["tahun", "siswa", "catatan"] and all(set(x) == KUNCI for x in p.values())
        assert p["siswa"]["is_numeric"] and p["siswa"]["unik"] == 6 and p["siswa"]["kosong"] == 0
        assert len(p["siswa"]["contoh"]) == 3 and p["siswa"]["deskripsi"] is None
        assert p["tahun"]["is_time"] and not p["siswa"]["is_time"]
        assert p["catatan"]["tipe"] == "text" and p["catatan"]["unik"] == 1 and not p["catatan"]["is_numeric"]


def test_deskripsi_tersimpan_dan_bisa_diubah():
    with TestClient(app) as c:
        did = setup(c)
        r = c.patch(f"/datasets/{did}/columns", json={"kolom": "siswa", "deskripsi": "Jumlah siswa aktif"})
        assert r.status_code == 200
        c.patch(f"/datasets/{did}/columns", json={"kolom": "siswa", "deskripsi": "Jumlah peserta didik"})
        p = {x["kolom"]: x for x in c.get(f"/datasets/{did}/columns").json()}
        assert p["siswa"]["deskripsi"] == "Jumlah peserta didik" and p["tahun"]["deskripsi"] is None


def test_kolom_tidak_ada_dan_belum_cleaning():
    with TestClient(app) as c:
        did = setup(c)
        r = c.patch(f"/datasets/{did}/columns", json={"kolom": "xyz", "deskripsi": "x"})
        assert r.status_code == 404 and r.json()["error_code"] == "KOLOM_TIDAK_DITEMUKAN"
        baru = c.post("/datasets/upload", files={"file": ("e.csv", CSV, "text/csv")}).json()["dataset_id"]
        assert c.get(f"/datasets/{baru}/columns").status_code == 400