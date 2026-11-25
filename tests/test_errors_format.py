import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient

from app.main import app

KUNCI = {"error_code", "message", "detail", "field", "timestamp"}


def test_404_route_dan_dataset_berformat_seragam():
    with TestClient(app) as c:
        for url in ("/tidak-ada", "/datasets/999999/export/xlsx"):
            r = c.get(url)
            assert r.status_code == 404 and set(r.json()) == KUNCI


def test_422_berformat_seragam():
    with TestClient(app) as c:
        r = c.patch("/datasets/1/data", json={"perubahan": "salah"})
        assert r.status_code == 422
        assert set(r.json()) == KUNCI and r.json()["error_code"] == "DATA_TIDAK_VALID"