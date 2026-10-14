import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.main import app

ALASAN = "sesuai dokumen laporan 2020"


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


def setup(c, csv=None):
    did = c.post("/datasets/upload", files={"file": ("d.csv", csv or make_csv(), "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def kosong_siswa(c, did):
    """Anomali 'kosong' di kolom siswa (wilayah D, 2020)."""
    return c.get(f"/datasets/{did}/anomalies/items", params={"jenis": "kosong", "kolom": "siswa"}).json()["data"][0]


def test_edit_fills_missing_and_tracks_everything():
    with TestClient(app) as c:
        did = setup(c)
        an = kosong_siswa(c, did)
        r = c.patch(f"/datasets/{did}/data", headers={"X-User": "budi"},
                    json={"alasan": ALASAN, "perubahan": [{"row_index": an["row_index"], "kolom": "siswa", "nilai": "120"}]})
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["versi_baru"] == 2 and b["jumlah_sel_diubah"] == 1 and b["anomali_diperbaiki"] == 1
        assert b["perubahan"][0]["nilai_lama"] is None and b["perubahan"][0]["nilai_baru"] == 120

        prev = c.get(f"/datasets/{did}/clean-preview", params={"limit": 50}).json()
        assert prev["versi"] == 2 and any(row["siswa"] == 120 for row in prev["preview"])

        e = c.get(f"/datasets/{did}/edits").json()
        assert e["total"] == 1 and e["data"][0]["alasan"] == ALASAN and e["data"][0]["diubah_oleh"] == "budi"
        assert e["ringkasan"]["baris_unik"] == 1 and e["ringkasan"]["baris_bersih"] == 12
        assert "1 dari 12 baris" in e["ringkasan"]["deskripsi"]

        s = c.get(f"/datasets/{did}/anomalies/summary").json()
        assert s["per_status"]["diperbaiki"] == 1 and s["per_status"]["pending"] == 4
        h = [x["langkah"] for x in c.get(f"/datasets/{did}/history").json()]
        assert h[-1] == "edit_data"


def test_edit_validation():
    with TestClient(app) as c:
        did = setup(c)
        u = f"/datasets/{did}/data"
        cell = {"row_index": 0, "kolom": "siswa", "nilai": 99}
        assert c.patch(u, json={"alasan": "x", "perubahan": [cell]}).status_code == 400            # alasan pendek
        assert c.patch(u, json={"alasan": ALASAN, "perubahan": []}).status_code == 422             # kosong
        assert c.patch(u, json={"alasan": ALASAN, "perubahan": [{**cell, "kolom": "nope"}]}).status_code == 400
        assert c.patch(u, json={"alasan": ALASAN, "perubahan": [{**cell, "row_index": 9999}]}).status_code == 400
        assert c.patch(u, json={"alasan": ALASAN, "perubahan": [{**cell, "nilai": "abc"}]}).status_code == 400  # kolom angka
        assert c.patch(u, json={"alasan": ALASAN, "perubahan": [cell, cell]}).status_code == 400   # sel dobel
        same = c.get(f"/datasets/{did}/clean-preview").json()["preview"][0]["siswa"]
        assert c.patch(u, json={"alasan": ALASAN, "perubahan": [{**cell, "nilai": same}]}).status_code == 400  # tanpa perubahan
        assert c.patch("/datasets/9999/data", json={"alasan": ALASAN, "perubahan": [cell]}).status_code == 404
        assert c.get(f"/datasets/{did}/edits").json()["total"] == 0                                 # tidak ada yang tersimpan


def test_edit_before_clean_and_text_column():
    with TestClient(app) as c:
        did = c.post("/datasets/upload", files={"file": ("d.csv", make_csv(), "text/csv")}).json()["dataset_id"]
        assert c.patch(f"/datasets/{did}/data", json={"alasan": ALASAN,
                       "perubahan": [{"row_index": 0, "kolom": "siswa", "nilai": 1}]}).status_code == 400
        c.post(f"/datasets/{did}/clean")
        r = c.patch(f"/datasets/{did}/data", json={"alasan": ALASAN, "perubahan": [
            {"row_index": 0, "kolom": "wilayah", "nilai": "  Z  "}, {"row_index": 1, "kolom": "guru", "nilai": None}]})
        assert r.status_code == 200 and r.json()["jumlah_sel_diubah"] == 2
        row = c.get(f"/datasets/{did}/clean-preview").json()["preview"][:2]
        assert row[0]["wilayah"] == "Z" and row[1]["guru"] is None


def test_reclean_guard_and_forecast_warning():
    csv = "tahun,siswa\n" + "\n".join(f"{2018 + i},{1000 + 50 * i}" for i in range(6)) + "\n"
    with TestClient(app) as c:
        did = setup(c, csv)
        assert c.post(f"/datasets/{did}/forecast", json={"nilai": "siswa"}).status_code == 200
        r = c.patch(f"/datasets/{did}/data", json={"alasan": ALASAN,
                    "perubahan": [{"row_index": 2, "kolom": "siswa", "nilai": 1111}]}).json()
        assert any("forecast" in w.lower() for w in r["peringatan"])
        assert c.post(f"/datasets/{did}/clean").status_code == 409                 # edit tidak hilang diam-diam
        assert c.get(f"/datasets/{did}/clean-preview").json()["versi"] == 2
        ok = c.post(f"/datasets/{did}/clean", params={"timpa": "true"})
        assert ok.status_code == 200 and ok.json()["versi"] == 3
        assert c.get(f"/datasets/{did}/edits").json()["total"] == 1                 # riwayat tetap ada


def test_bulk_review_does_not_touch_fixed():
    with TestClient(app) as c:
        did = setup(c)
        an = kosong_siswa(c, did)
        c.patch(f"/datasets/{did}/data", json={"alasan": ALASAN,
                "perubahan": [{"row_index": an["row_index"], "kolom": "siswa", "nilai": 100}]})
        r = c.post(f"/datasets/{did}/anomalies/review", json={"status": "pending", "semua": True, "dari_status": "semua"})
        assert r.json()["jumlah_diubah"] == 4                                      # yang 'diperbaiki' tidak ikut
        assert c.post(f"/datasets/{did}/anomalies/review",
                      json={"status": "diperbaiki", "semua": True}).status_code == 400