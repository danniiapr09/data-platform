import io
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import func, select

from app.db import SessionLocal
from app.main import app
from app.models import CleanData

CSV = "tahun,siswa,catatan\n" + "\n".join(f"{2018 + i},{1000 + 50 * i},ok" for i in range(6)) + "\n"
ALASAN = "sesuai dokumen resmi 2020"
H = {"X-User": "sari@instansi.id"}


def setup(c):
    did = c.post("/datasets/upload", files={"file": ("d.csv", CSV, "text/csv")}).json()["dataset_id"]
    c.post(f"/datasets/{did}/clean")
    return did


def edit(c, did, perubahan, alasan=ALASAN):
    r = c.patch(f"/datasets/{did}/data", headers=H, json={"alasan": alasan, "perubahan": perubahan})
    assert r.status_code == 200, r.text


def workbook(c, did):
    r = c.get(f"/datasets/{did}/export/xlsx")
    assert r.status_code == 200
    return load_workbook(io.BytesIO(r.content))


def kv(ws):
    return {row[0].value: row[1].value for row in ws.iter_rows(min_row=2)}


def terwarna(cell):
    return cell.fill.fill_type == "solid" and str(cell.fill.fgColor.rgb).endswith("FFF2CC")


def test_without_edits_nothing_changes():
    with TestClient(app) as c:
        did = setup(c)
        wb = workbook(c, did)
        assert "Riwayat Perubahan" not in wb.sheetnames
        ring = kv(wb["Ringkasan"])
        assert ring["Edit manual (jumlah perubahan)"] == 0 and ring["Persen baris diedit (%)"] == 0
        assert "Catatan edit" not in ring
        assert not any(terwarna(cell) for row in wb["Data Bersih"].iter_rows() for cell in row)


def test_history_sheet_summary_and_highlight():
    with TestClient(app) as c:
        did = setup(c)
        edit(c, did, [{"row_index": 2, "kolom": "siswa", "nilai": 1111},
                      {"row_index": 4, "kolom": "catatan", "nilai": "direvisi"}])
        wb = workbook(c, did)
        assert "Riwayat Perubahan" in wb.sheetnames
        rows = list(wb["Riwayat Perubahan"].iter_rows(min_row=1, values_only=True))
        assert rows[0] == ("waktu_utc", "versi", "baris_di_file_asli", "kolom", "nilai_lama",
                           "nilai_baru", "alasan", "diubah_oleh")
        assert len(rows) == 3
        r = {x[3]: x for x in rows[1:]}
        assert r["siswa"][2] == 4 and r["siswa"][4] == 1100 and r["siswa"][5] == 1111     # baris di file asli = row_index + 2
        assert r["siswa"][6] == ALASAN and r["siswa"][7] == "sari@instansi.id"

        ring = kv(wb["Ringkasan"])
        assert ring["Edit manual (jumlah perubahan)"] == 2 and ring["Baris diedit manual"] == 2
        assert ring["Persen baris diedit (%)"] == round(2 / 6 * 100, 2) and "Catatan edit" in ring

        ws = wb["Data Bersih"]
        head = [c.value for c in ws[1]]
        siswa, catatan = head.index("siswa") + 1, head.index("catatan") + 1
        assert terwarna(ws.cell(row=4, column=siswa)) and terwarna(ws.cell(row=6, column=catatan))
        diwarnai = [(c.row, c.column) for row in ws.iter_rows(min_row=2) for c in row if terwarna(c)]
        assert sorted(diwarnai) == sorted([(4, siswa), (6, catatan)])                   # hanya sel yang diedit


def test_overwritten_edit_is_in_history_but_not_highlighted():
    """Setelah data dibersihkan ulang, nilai kembali ke asli: riwayat tetap ada, warna tidak dipasang."""
    with TestClient(app) as c:
        did = setup(c)
        edit(c, did, [{"row_index": 2, "kolom": "siswa", "nilai": 1111}])
        with SessionLocal() as db:                       # simulasi cleaning ulang: versi terbaru kembali ke nilai awal
            v = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == did))
            row = db.scalars(select(CleanData).where(CleanData.dataset_id == did, CleanData.version == v,
                                                      CleanData.row_index == 2)).one()
            row.row_json = {**row.row_json, "siswa": 1100}
            db.commit()
        wb = workbook(c, did)
        assert wb["Riwayat Perubahan"].max_row == 2
        assert not any(terwarna(cell) for row in wb["Data Bersih"].iter_rows() for cell in row)


def test_history_sheet_blocks_formula_injection():
    with TestClient(app) as c:
        did = setup(c)
        edit(c, did, [{"row_index": 1, "kolom": "catatan", "nilai": "=HYPERLINK(1)"}], alasan="=cmd|' /C calc'!A0")
        ws = load_workbook(io.BytesIO(c.get(f"/datasets/{did}/export/xlsx").content))["Riwayat Perubahan"]
        isi = [c.value for c in ws[2]]
        assert "'=HYPERLINK(1)" in isi and "'=cmd|' /C calc'!A0" in isi