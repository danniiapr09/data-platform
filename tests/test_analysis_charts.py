import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.main import app

CSV = """wilayah,jenjang,tahun,siswa
Bandung,SMA,2023,100
Bandung,SMA,2024,110
Bandung,SMK,2023,50
Bandung,SMK,2024,60
Cimahi,SMA,2023,30
Cimahi,SMA,2024,40
"""


def setup(c, clean=True):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    if clean:
        c.post(f"/datasets/{did}/clean")
    return did


def test_hierarchy_tree_sum():
    with TestClient(app) as c:
        did = setup(c)
        r = c.get(f"/datasets/{did}/analysis/hierarchy?levels=wilayah,jenjang&metric=siswa&agg=sum").json()
        assert r["name"] == "root" and [x["name"] for x in r["children"]] == ["Bandung", "Cimahi"]
        bandung = {x["name"]: x["value"] for x in r["children"][0]["children"]}
        assert bandung == {"SMA": 210, "SMK": 110}
        assert r["children"][1]["children"] == [{"name": "SMA", "value": 70}]


def test_hierarchy_count_needs_no_metric():
    with TestClient(app) as c:
        did = setup(c)
        r = c.get(f"/datasets/{did}/analysis/hierarchy?levels=wilayah&agg=count").json()
        assert {x["name"]: x["value"] for x in r["children"]} == {"Bandung": 4, "Cimahi": 2}


def test_matrix_values_and_missing_combination():
    with TestClient(app) as c:
        did = setup(c)
        r = c.get(f"/datasets/{did}/analysis/matrix?row=tahun&col=wilayah&metric=siswa&agg=sum").json()
        assert r["rows"] == ["2023", "2024"] and r["cols"] == ["Bandung", "Cimahi"]
        assert r["values"] == [[150, 30], [170, 40]] and r["min"] == 30 and r["max"] == 170
        r = c.get(f"/datasets/{did}/analysis/matrix?row=jenjang&col=wilayah&metric=siswa").json()
        assert r["values"] == [[210, 70], [110, None]]          # SMK tidak ada di Cimahi


def test_validation_errors():
    with TestClient(app) as c:
        did = setup(c)
        base = f"/datasets/{did}/analysis"

        def kode(url):
            r = c.get(url)
            assert r.status_code == 422
            return r.json()["error_code"]

        assert kode(f"{base}/hierarchy?levels=xyz&metric=siswa") == "COLUMN_NOT_FOUND"
        assert kode(f"{base}/hierarchy?levels=wilayah") == "METRIC_REQUIRED"
        assert kode(f"{base}/hierarchy?levels=wilayah&metric=jenjang") == "METRIC_NOT_NUMERIC"
        assert kode(f"{base}/hierarchy?levels=wilayah&metric=siswa&agg=salah") == "INVALID_AGG"
        assert kode(f"{base}/matrix?row=tahun&col=tahun&metric=siswa") == "SAME_AXIS"


def test_not_cleaned_dataset():
    with TestClient(app) as c:
        did = setup(c, clean=False)
        assert c.get(f"/datasets/{did}/analysis/hierarchy?levels=wilayah&agg=count").status_code == 400