import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, AuditLog, CleanData, DataEdit, Dataset, Forecast, ProcessingLog
from ..security import Actor, get_actor

router = APIRouter(prefix="/datasets/{dataset_id}", tags=["edit data"])


class CellEdit(BaseModel):
    row_index: int
    kolom: str
    nilai: str | int | float | None = None   # null / "" = kosongkan sel


class EditIn(BaseModel):
    perubahan: list[CellEdit] = Field(..., min_length=1, max_length=200)
    alasan: str = Field(..., max_length=500)  # wajib, mis. sumber data atau nomor dokumen


def _get_dataset(db: Session, dataset_id: int) -> Dataset:
    ds = db.get(Dataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset tidak ditemukan.")
    return ds


def _latest_rows(db: Session, dataset_id: int):
    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    if not version:
        raise HTTPException(400, "Dataset belum di-cleaning. Jalankan cleaning dulu sebelum mengedit.")
    rows = db.scalars(select(CleanData).where(CleanData.dataset_id == dataset_id,
                                              CleanData.version == version)
                      .order_by(CleanData.row_index)).all()
    return version, rows


def _is_numeric_col(rows, kolom: str) -> bool:
    vals = [r.row_json.get(kolom) for r in rows if r.row_json.get(kolom) is not None]
    return bool(vals) and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vals)


def _convert(nilai, numeric: bool, kolom: str):
    if isinstance(nilai, str):
        nilai = nilai.strip()
        if nilai == "":
            return None
    if nilai is None:
        return None
    if numeric:
        try:
            num = float(nilai)
        except (TypeError, ValueError):
            raise HTTPException(400, f"Kolom '{kolom}' bertipe angka, nilai '{nilai}' bukan angka.")
        if num != num or num in (float("inf"), float("-inf")):
            raise HTTPException(400, f"Nilai untuk kolom '{kolom}' tidak valid.")
        return int(num) if num.is_integer() else num
    return nilai


def _dump(v) -> str:
    return json.dumps(v, ensure_ascii=False)


@router.patch("/data")
def edit_data(dataset_id: int, body: EditIn, actor: Actor = Depends(get_actor),
              db: Session = Depends(get_db)):
    """Ubah nilai sel di data bersih. Data mentah tidak disentuh; hasilnya jadi versi baru."""
    _get_dataset(db, dataset_id)
    alasan = body.alasan.strip()
    if len(alasan) < 5:
        raise HTTPException(400, "Alasan wajib diisi (minimal 5 karakter), mis. sumber data atau nomor dokumen.")
    version, rows = _latest_rows(db, dataset_id)
    by_idx = {r.row_index: r for r in rows}
    numeric_cache: dict = {}

    seen, changes, skipped = set(), [], 0
    for p in body.perubahan:
        if (p.row_index, p.kolom) in seen:
            raise HTTPException(400, f"Sel baris {p.row_index} kolom '{p.kolom}' muncul lebih dari sekali.")
        seen.add((p.row_index, p.kolom))
        r = by_idx.get(p.row_index)
        if r is None:
            raise HTTPException(400, f"Baris {p.row_index} tidak ada di data bersih.")
        if p.kolom not in r.row_json:
            raise HTTPException(400, f"Kolom '{p.kolom}' tidak ada. Kolom tersedia: {', '.join(r.row_json)}.")
        if p.kolom not in numeric_cache:
            numeric_cache[p.kolom] = _is_numeric_col(rows, p.kolom)
        baru = _convert(p.nilai, numeric_cache[p.kolom], p.kolom)
        lama = r.row_json.get(p.kolom)
        if baru == lama:
            skipped += 1
            continue
        changes.append((r, p.kolom, lama, baru))
    if not changes:
        raise HTTPException(400, "Tidak ada perubahan: semua nilai sama dengan data saat ini.")

    new_version = version + 1
    changed: dict = {}
    for r, kol, _, baru in changes:
        changed.setdefault(r.row_index, {})[kol] = baru
    db.bulk_insert_mappings(CleanData, [
        {"dataset_id": dataset_id, "version": new_version, "row_index": r.row_index,
         "row_json": {**r.row_json, **changed.get(r.row_index, {})}} for r in rows])

    user = actor.user
    for r, kol, lama, baru in changes:
        db.add(DataEdit(dataset_id=dataset_id, versi_baru=new_version, row_index=r.row_index,
                        kolom=kol, nilai_lama=_dump(lama), nilai_baru=_dump(baru),
                        alasan=alasan, diubah_oleh=user))

    n_anom = 0   # anomali pada sel yang sama otomatis jadi 'diperbaiki'
    for r, kol, _, _ in changes:
        for a in db.scalars(select(Anomaly).where(
                Anomaly.dataset_id == dataset_id, Anomaly.row_index == r.row_index,
                Anomaly.kolom == kol, Anomaly.status != "diperbaiki")).all():
            a.status = "diperbaiki"
            n_anom += 1

    pengedit = user or "tidak diketahui"
    db.add(ProcessingLog(dataset_id=dataset_id, langkah="edit_data",
                         ringkasan=f"v{new_version}: {len(changes)} sel diubah oleh {pengedit}. Alasan: {alasan[:150]}"))
    db.add(AuditLog(aksi=f"edit data dataset {dataset_id} v{new_version}: {len(changes)} sel oleh {pengedit}"[:200]))
    ada_forecast = db.scalar(select(func.count()).select_from(Forecast)
                             .where(Forecast.dataset_id == dataset_id)) > 0
    db.commit()

    peringatan = []
    if ada_forecast:
        peringatan.append("Hasil forecast sebelumnya dihitung dari data sebelum edit. Jalankan ulang forecast.")
    return {
        "versi_baru": new_version, "jumlah_sel_diubah": len(changes), "dilewati": skipped,
        "anomali_diperbaiki": n_anom, "diubah_oleh": pengedit, "peringatan": peringatan,
        "perubahan": [{"row_index": r.row_index, "baris_di_file_asli": r.row_index + 2,
                       "kolom": kol, "nilai_lama": lama, "nilai_baru": baru}
                      for r, kol, lama, baru in changes],
    }


@router.get("/edits")
def list_edits(dataset_id: int, row_index: int | None = None, kolom: str | None = None,
               limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Riwayat edit manual (terbaru dulu) + ringkasan seberapa banyak data yang pernah diedit."""
    _get_dataset(db, dataset_id)
    semua = db.scalars(select(DataEdit).where(DataEdit.dataset_id == dataset_id)).all()
    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    baris_bersih = 0
    if version:
        baris_bersih = db.scalar(select(func.count()).select_from(CleanData)
                                 .where(CleanData.dataset_id == dataset_id, CleanData.version == version))
    baris_unik = {e.row_index for e in semua}
    persen = round(len(baris_unik) / baris_bersih * 100, 2) if baris_bersih else None
    ringkasan = {
        "jumlah_perubahan": len(semua),
        "sel_unik": len({(e.row_index, e.kolom) for e in semua}),
        "baris_unik": len(baris_unik), "baris_bersih": baris_bersih, "persen_baris_diedit": persen,
        "pengedit": sorted({e.diubah_oleh or "tidak diketahui" for e in semua}),
        "deskripsi": (f"{len(baris_unik)} dari {baris_bersih} baris ({str(persen).replace('.', ',')}%) "
                      f"pernah diedit manual melalui {len(semua)} perubahan."
                      if semua else "Belum ada edit manual."),
    }
    q = select(DataEdit).where(DataEdit.dataset_id == dataset_id)
    if row_index is not None:
        q = q.where(DataEdit.row_index == row_index)
    if kolom:
        q = q.where(DataEdit.kolom == kolom)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(DataEdit.id.desc())
                      .limit(min(max(limit, 1), 500)).offset(max(offset, 0))).all()
    return {
        "ringkasan": ringkasan, "total": total,
        "data": [{"id": e.id, "versi_baru": e.versi_baru, "row_index": e.row_index,
                  "baris_di_file_asli": e.row_index + 2, "kolom": e.kolom,
                  "nilai_lama": json.loads(e.nilai_lama), "nilai_baru": json.loads(e.nilai_baru),
                  "alasan": e.alasan, "diubah_oleh": e.diubah_oleh or "tidak diketahui",
                  "waktu": e.waktu.isoformat()} for e in rows],
    }