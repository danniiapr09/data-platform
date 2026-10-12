import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.api.anomalies import jenis_of
from app.main import app


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
                guru = "x"          # bukan angka
            rows.append(f"{w},{t},{siswa},{guru}")
    return "\n".join(rows) + "\n"


def setup(c):
    did = c.post("/datasets/upload", files={"file": ("d.csv", make_csv(), "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def test_jenis_of():
    assert jenis_of("[outlier] nilai 5") == "outlier"
    assert jenis_of("tanpa awalan") == "lainnya"


def test_summary_groupings():
    with TestClient(app) as c:
        did = setup(c)
        u = f"/datasets/{did}/anomalies/summary"
        r = c.get(u).json()
        by = {g["kelompok"]: g["jumlah"] for g in r["kelompok"]}
        assert by == {"kosong": 3, "outlier": 1, "format": 1} and r["total"] == 5
        assert r["kelompok"][0]["kelompok"] == "kosong" and "5 anomali" in r["deskripsi"]
        assert r["per_status"]["pending"] == 5

        by = {g["kelompok"]: g["jumlah"] for g in c.get(u, params={"group_by": "kolom"}).json()["kelompok"]}
        assert by == {"guru": 3, "siswa": 2}
        by = {g["kelompok"]: g["jumlah"] for g in
              c.get(u, params={"group_by": "data", "data_kolom": "Wilayah"}).json()["kelompok"]}
        assert by == {"F": 2, "C": 1, "D": 1, "E": 1}
        assert c.get(u, params={"group_by": "status"}).json()["kelompok"][0]["kelompok"] == "pending"

        assert c.get(u, params={"group_by": "ngawur"}).status_code == 400
        assert c.get(u, params={"group_by": "data"}).status_code == 400
        assert c.get(u, params={"group_by": "data", "data_kolom": "nope"}).status_code == 400
        assert c.get(u, params={"status": "x"}).status_code == 400
        assert c.get("/datasets/9999/anomalies/summary").status_code == 404


def test_items_filter():
    with TestClient(app) as c:
        did = setup(c)
        u = f"/datasets/{did}/anomalies/items"
        r = c.get(u, params={"jenis": "kosong"}).json()
        assert r["total"] == 3 and all(i["jenis"] == "kosong" for i in r["data"])
        assert r["data"][0]["baris_di_file_asli"] == r["data"][0]["row_index"] + 2
        assert c.get(u, params={"kolom": "siswa"}).json()["total"] == 2
        assert len(c.get(u, params={"limit": 2}).json()["data"]) == 2


def test_bulk_review():
    with TestClient(app) as c:
        did = setup(c)
        u = f"/datasets/{did}/anomalies/review"
        assert c.post(u, json={"status": "diterima"}).status_code == 400            # tanpa kriteria
        assert c.post(u, json={"status": "ngawur", "jenis": "kosong"}).status_code == 400
        r = c.post(u, json={"status": "diterima", "jenis": "kosong"}).json()
        assert r["jumlah_diubah"] == 3
        assert c.post(u, json={"status": "ditolak", "jenis": "kosong"}).json()["jumlah_diubah"] == 0  # sudah diputuskan
        assert c.post(u, json={"status": "ditolak", "jenis": "kosong", "dari_status": "semua"}).json()["jumlah_diubah"] == 3
        s = c.get(f"/datasets/{did}/anomalies/summary").json()
        kos = next(g for g in s["kelompok"] if g["kelompok"] == "kosong")
        assert kos["ditolak"] == 3 and s["per_status"]["pending"] == 2
        one = c.get(f"/datasets/{did}/anomalies/items", params={"jenis": "outlier"}).json()["data"][0]["id"]
        assert c.post(u, json={"status": "diterima", "ids": [one]}).json()["jumlah_diubah"] == 1
        assert c.post(u, json={"status": "pending", "semua": True, "dari_status": "semua"}).json()["jumlah_diubah"] == 5