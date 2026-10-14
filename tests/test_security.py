import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.main import app
from app.security import Actor, require_role

KEY = "rahasia-123"
CSV = "tahun,siswa\n" + "\n".join(f"{2018 + i},{1000 + 50 * i}" for i in range(6)) + "\n"


def test_api_key_enforced(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", KEY)
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200                              # health tetap terbuka
        assert c.get("/datasets").status_code == 401
        assert c.get("/datasets", headers={"X-API-Key": "salah"}).status_code == 401
        assert c.get("/datasets", headers={"X-API-Key": KEY}).status_code == 200
        up = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")})
        assert up.status_code == 401                                              # upload tanpa kunci ditolak
        for path in ("/datasets/1", "/datasets/1/export/xlsx", "/datasets/1/edits", "/datasets/1/anomalies/summary"):
            assert c.get(path).status_code == 401, path
        assert "APIKeyHeader" in c.get("/openapi.json").json()["components"]["securitySchemes"]


def test_dev_mode_is_open(monkeypatch):
    monkeypatch.delenv("INTERNAL_API_KEY", raising=False)
    with TestClient(app) as c:
        assert c.get("/datasets").status_code == 200


def test_actor_is_recorded_from_headers(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_KEY", KEY)
    h = {"X-API-Key": KEY, "X-User": "sari@instansi.id", "X-Role": "Editor"}
    with TestClient(app) as c:
        did = c.post("/datasets/upload", headers=h, files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
        c.post(f"/datasets/{did}/clean", headers=h)
        r = c.patch(f"/datasets/{did}/data", headers=h, json={
            "alasan": "sesuai dokumen resmi", "perubahan": [{"row_index": 1, "kolom": "siswa", "nilai": 1234}]})
        assert r.status_code == 200 and r.json()["diubah_oleh"] == "sari@instansi.id"
        e = c.get(f"/datasets/{did}/edits", headers=h).json()
        assert e["data"][0]["diubah_oleh"] == "sari@instansi.id"


def test_require_role(monkeypatch):
    mini = FastAPI()

    @mini.get("/x")
    def x(actor: Actor = Depends(require_role("admin", "editor"))):
        return {"role": actor.role}

    with TestClient(mini) as c:
        monkeypatch.delenv("ENFORCE_ROLES", raising=False)
        assert c.get("/x").status_code == 200                                      # belum diaktifkan
        monkeypatch.setenv("ENFORCE_ROLES", "true")
        assert c.get("/x").status_code == 403                                      # tanpa role
        assert c.get("/x", headers={"X-Role": "viewer"}).status_code == 403
        assert c.get("/x", headers={"X-Role": "ADMIN"}).json() == {"role": "admin"}  # huruf besar dinormalkan