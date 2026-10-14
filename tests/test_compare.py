import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis import compare as cmp
from app.main import app


def df():
    return pd.DataFrame({
        "wilayah": ["A", "A", "B", "B", "C", "C"],
        "tahun": [2023, 2024] * 3,
        "siswa": [100, 110, 200, 210, 50, 40],
        "guru": [10, 10, 10, 10, 0, 5],
    })


def test_fmt():
    assert cmp.fmt(244524) == "244.524"
    assert cmp.fmt(1234.5) == "1.234,50"
    assert cmp.fmt(2.345, 1) == "2,3" and cmp.fmt(None) == "-"


def test_compare_group_with_period_filter():
    sub = cmp.apply_filters(df(), "tahun", periode="2024")
    r = cmp.compare(sub, "siswa", "wilayah", "tahun", ket_filter=cmp.describe_filters(periode="2024"))
    assert [d["label"] for d in r["data"]] == ["B", "A", "C"]
    assert sum(d["persen_dari_total"] for d in r["data"]) == pytest.approx(100, abs=0.1)
    assert "tertinggi di B" in r["deskripsi"] and "Data difilter: periode 2024" in r["deskripsi"]
    assert "donut" in r["grafik_disarankan"]


def test_compare_over_time_and_top_and_filter_values():
    r = cmp.compare(df(), "siswa", "tahun", "tahun")
    assert [d["label"] for d in r["data"]] == [2023, 2024]
    assert "garis" in r["grafik_disarankan"] and "naik" in r["deskripsi"]
    sub = cmp.apply_filters(df(), "tahun", filter_kolom="wilayah", filter_nilai="A, B")
    assert {d["label"] for d in cmp.compare(sub, "siswa", "wilayah", "tahun")["data"]} == {"A", "B"}
    assert len(cmp.compare(df(), "siswa", "wilayah", "tahun", top=2)["data"]) == 2
    sub = cmp.apply_filters(df(), "tahun", dari=2024)
    assert len(sub) == 3


def test_compare_periode():
    r = cmp.compare_periode(df(), "siswa", "wilayah", "tahun", 2023, 2024)
    by = {d["label"]: d for d in r["data"]}
    assert by["A"]["selisih"] == 10 and by["C"]["selisih"] == -10 and by["C"]["persen"] == -20
    assert r["total_a"] == 350 and r["total_b"] == 360
    assert "Kenaikan terbesar" in r["deskripsi"] and "Penurunan terbesar: C" in r["deskripsi"]


def test_ratio():
    sub = cmp.apply_filters(df(), "tahun", periode="2023")
    r = cmp.ratio(sub, "siswa", "guru", "wilayah", "tahun")
    by = {d["label"]: d["rasio"] for d in r["data"]}
    assert by["A"] == 10 and by["B"] == 20 and by["C"] is None   # penyebut 0 tidak dihitung
    assert r["rasio_keseluruhan"] == pytest.approx(17.5)
    assert "penyebutnya 0" in r["deskripsi"]
    p = cmp.ratio(df(), "guru", "siswa", "wilayah", "tahun", sebagai_persen=True)
    assert p["rasio_keseluruhan"] == pytest.approx(45 / 710 * 100, abs=0.01) and p["satuan"] == "%"


def test_errors():
    with pytest.raises(ValueError):
        cmp.compare(df(), "nope", "wilayah", "tahun")
    with pytest.raises(ValueError):
        cmp.compare(df(), "siswa", "wilayah", "tahun", agg="x")
    with pytest.raises(ValueError):
        cmp.apply_filters(df(), "tahun", periode="1999")
    with pytest.raises(ValueError):
        cmp.apply_filters(df(), "tahun", filter_kolom="wilayah")
    with pytest.raises(ValueError):
        cmp.compare_periode(df(), "siswa", "wilayah", "tahun", 2023, 1999)


CSV = ("wilayah,tahun,siswa,guru\nA,2022,100,10\nA,2023,110,10\nA,2024,120,12\n"
       "B,2022,200,10\nB,2023,210,10\nB,2024,220,11\nC,2022,50,5\nC,2023,45,5\nC,2024,40,5\n")


def test_api_flow():
    with TestClient(app) as c:
        did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
        assert c.get(f"/datasets/{did}/compare/options").status_code == 400      # belum cleaning
        c.post(f"/datasets/{did}/clean")
        o = c.get(f"/datasets/{did}/compare/options").json()
        assert o["kolom_waktu"] == "tahun" and o["kolom_angka"] == ["siswa", "guru"]
        assert o["periode"] == ["2022", "2023", "2024"] and o["pilihan_filter"]["wilayah"] == ["A", "B", "C"]
        assert "tahun" in o["kolom_kelompok"] and "wilayah" in o["kolom_kelompok"]

        r = c.get(f"/datasets/{did}/compare", params={"nilai": "siswa", "kelompok": "wilayah", "periode": "2024"}).json()
        assert r["data"][0]["label"] == "B" and r["deskripsi"]
        r = c.get(f"/datasets/{did}/compare", params={"nilai": "siswa", "kelompok": "tahun"}).json()
        assert [d["label"] for d in r["data"]] == [2022, 2023, 2024]
        r = c.get(f"/datasets/{did}/compare/periode",
                  params={"nilai": "siswa", "kelompok": "wilayah", "periode_a": 2022, "periode_b": 2024}).json()
        assert r["total_a"] == 350 and r["total_b"] == 380
        r = c.get(f"/datasets/{did}/ratio", params={"pembilang": "siswa", "penyebut": "guru",
                                                    "kelompok": "wilayah", "periode": "2024"}).json()
        assert r["data"][0]["label"] == "B" and r["rasio_keseluruhan"] == pytest.approx(380 / 28, abs=0.01)

        assert c.get(f"/datasets/{did}/compare", params={"nilai": "x", "kelompok": "wilayah"}).status_code == 400
        assert c.get(f"/datasets/{did}/compare", params={"nilai": "siswa", "kelompok": "wilayah",
                                                          "periode": "1999"}).status_code == 400
        assert c.get("/datasets/9999/ratio", params={"pembilang": "a", "penyebut": "b",
                                                      "kelompok": "c"}).status_code == 404