import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.main import app

CSV = "tahun,siswa,catatan\n" + "\n".join(f"{2018 + i},{1000 + 50 * i},ok" for i in range(6)) + "\n"


def upload(c, content=CSV):
    return c.post("/datasets/upload", files={"file": ("d.csv", content, "text/csv")}).json()["dataset_id"]


def lines(r):
    return r.content.decode("utf-8-sig").strip().splitlines()


def test_raw_csv_is_complete():
    with TestClient(app) as c:
        did = upload(c)
        r = c.get(f"/datasets/{did}/export/raw.csv")
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        assert 'filename="d_raw.csv"' in r.headers["content-disposition"]
        rows = lines(r)
        assert rows[0] == "tahun,siswa,catatan" and len(rows) == 7 and rows[1] == "2018,1000,ok"


def test_clean_csv_uses_latest_version():
    with TestClient(app) as c:
        did = upload(c)
        c.post(f"/datasets/{did}/clean")
        r = c.get(f"/datasets/{did}/export/clean.csv")
        assert r.status_code == 200 and 'filename="d_clean_v1.csv"' in r.headers["content-disposition"]
        assert len(lines(r)) == 7


def test_clean_csv_requires_cleaning_and_unknown_dataset():
    with TestClient(app) as c:
        did = upload(c)
        r = c.get(f"/datasets/{did}/export/clean.csv")
        assert r.status_code == 400 and r.json()["error_code"] == "DATASET_NOT_CLEANED"
        assert c.get("/datasets/999999/export/raw.csv").status_code == 404


def test_csv_blocks_formula_injection():
    with TestClient(app) as c:
        did = upload(c, "tahun,catatan\n2020,=HYPERLINK(1)\n")
        assert "'=HYPERLINK(1)" in c.get(f"/datasets/{did}/export/raw.csv").content.decode("utf-8-sig")