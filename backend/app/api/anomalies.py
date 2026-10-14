from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, AuditLog, Dataset, RawData

router = APIRouter(prefix="/datasets/{dataset_id}/anomalies", tags=["anomali"])

REVIEW_STATUSES = ("pending", "diterima", "ditolak")   # pilihan pegawai saat review
STATUSES = REVIEW_STATUSES + ("diperbaiki",)            # "diperbaiki" otomatis saat sel diedit
GROUPS = ("jenis", "kolom", "status", "data")


def jenis_of(alasan: str) -> str:
    """Jenis anomali diambil dari awalan alasan, mis. '[outlier] nilai 500 ...' -> 'outlier'."""
    if alasan.startswith("["):
        end = alasan.find("]")
        if end > 1:
            return alasan[1:end]
    return "lainnya"


def _norm(c) -> str:
    return str(c).strip().lower().replace(" ", "_")


def _get_dataset(db: Session, dataset_id: int) -> Dataset:
    ds = db.get(Dataset, dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset tidak ditemukan.")
    return ds


def _check_status(s: str, boleh=STATUSES):
    if s not in boleh:
        raise HTTPException(400, f"Status harus salah satu dari: {', '.join(boleh)}.")


def _filtered(dataset_id, jenis=None, kolom=None, status=None):
    q = select(Anomaly).where(Anomaly.dataset_id == dataset_id)
    if jenis:
        q = q.where(Anomaly.alasan.startswith(f"[{jenis}]", autoescape=True))
    if kolom:
        q = q.where(Anomaly.kolom == kolom)
    if status:
        q = q.where(Anomaly.status == status)
    return q


def _data_values(db: Session, dataset_id: int, indices: list[int], data_kolom: str) -> dict:
    """Ambil nilai satu kolom data (mis. wilayah) dari data mentah untuk baris-baris beranomali."""
    out, found, target = {}, False, _norm(data_kolom)
    for i in range(0, len(indices), 500):
        chunk = indices[i:i + 500]
        q = select(RawData.row_index, RawData.row_json).where(
            RawData.dataset_id == dataset_id, RawData.row_index.in_(chunk))
        for ridx, rj in db.execute(q):
            key = next((k for k in rj if _norm(k) == target), None)
            if key is None:
                continue
            found = True
            v = rj[key]
            out[ridx] = "(kosong)" if v is None or str(v).strip() == "" else str(v).strip()
    if indices and not found:
        raise HTTPException(400, f"Kolom data '{data_kolom}' tidak ada.")
    return out


def _item(a: Anomaly) -> dict:
    return {"id": a.id, "row_index": a.row_index, "baris_di_file_asli": a.row_index + 2,
            "kolom": a.kolom, "jenis": jenis_of(a.alasan), "alasan": a.alasan, "status": a.status}


@router.get("/summary")
def summary(dataset_id: int, group_by: str = "jenis", data_kolom: str | None = None,
            status: str | None = None, db: Session = Depends(get_db)):
    """Anomali dikelompokkan: group_by = jenis | kolom | status | data (isi data_kolom, mis. wilayah)."""
    _get_dataset(db, dataset_id)
    if group_by not in GROUPS:
        raise HTTPException(400, f"group_by harus salah satu dari: {', '.join(GROUPS)}.")
    if status:
        _check_status(status)
    if group_by == "data" and not data_kolom:
        raise HTTPException(400, "Isi data_kolom untuk group_by=data (mis. data_kolom=wilayah).")

    rows = db.scalars(_filtered(dataset_id, status=status).order_by(Anomaly.row_index)).all()
    values = _data_values(db, dataset_id, [r.row_index for r in rows], data_kolom) if group_by == "data" else {}

    def key(a: Anomaly) -> str:
        if group_by == "jenis":
            return jenis_of(a.alasan)
        if group_by == "kolom":
            return "(seluruh baris)" if a.kolom == "*" else a.kolom
        if group_by == "status":
            return a.status
        return values.get(a.row_index, "(kosong)")

    groups: dict = {}
    for a in rows:
        g = groups.setdefault(key(a), {"kelompok": key(a), "jumlah": 0,
                                       **{s: 0 for s in STATUSES}, "contoh": []})
        g["jumlah"] += 1
        g[a.status] = g.get(a.status, 0) + 1
        if len(g["contoh"]) < 3:
            g["contoh"].append(_item(a))
    data = sorted(groups.values(), key=lambda g: (-g["jumlah"], str(g["kelompok"])))

    total = len(rows)
    per_status = {s: sum(g[s] for g in data) for s in STATUSES}
    if total:
        top = ", ".join(f"{g['kelompok']} {g['jumlah']}" for g in data[:5])
        deskripsi = (f"{total} anomali dikelompokkan per {group_by if group_by != 'data' else data_kolom}: {top}"
                     f"{', dan lainnya' if len(data) > 5 else ''}. "
                     f"{per_status['pending']} masih pending, {per_status['diterima']} diterima, "
                     f"{per_status['ditolak']} ditolak, {per_status['diperbaiki']} diperbaiki.")
    else:
        deskripsi = "Tidak ada anomali."
    return {"dataset_id": dataset_id, "group_by": group_by, "total": total,
            "per_status": per_status, "kelompok": data, "deskripsi": deskripsi}


@router.get("/items")
def items(dataset_id: int, jenis: str | None = None, kolom: str | None = None,
          status: str | None = None, limit: int = 50, offset: int = 0,
          db: Session = Depends(get_db)):
    """Daftar anomali dengan filter (dipakai saat satu kelompok dibuka di UI)."""
    _get_dataset(db, dataset_id)
    if status:
        _check_status(status)
    q = _filtered(dataset_id, jenis, kolom, status)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Anomaly.row_index, Anomaly.id)
                      .limit(min(max(limit, 1), 500)).offset(max(offset, 0))).all()
    return {"total": total, "limit": limit, "offset": offset, "data": [_item(a) for a in rows]}


class BulkReviewIn(BaseModel):
    status: str                     # diterima | ditolak | pending
    jenis: str | None = None        # filter: kosong | outlier | duplikat | format
    kolom: str | None = None        # filter: nama kolom anomali
    ids: list[int] | None = None    # atau pilih anomali tertentu
    semua: bool = False             # true = semua anomali dataset ini (harus eksplisit)
    dari_status: str = "pending"    # hanya ubah yang berstatus ini; "semua" = abaikan status lama


@router.post("/review")
def bulk_review(dataset_id: int, body: BulkReviewIn, db: Session = Depends(get_db)):
    """Review massal, mis. terima semua anomali 'kosong' sekaligus."""
    _get_dataset(db, dataset_id)
    _check_status(body.status, REVIEW_STATUSES)
    _check_status(body.dari_status, STATUSES + ("semua",))
    if not (body.jenis or body.kolom or body.ids or body.semua):
        raise HTTPException(400, "Tentukan jenis, kolom, ids, atau semua=true agar tidak mengubah tanpa sengaja.")
    q = _filtered(dataset_id, body.jenis, body.kolom).where(Anomaly.status !="diperbaiki")
    if body.ids:
        q = q.where(Anomaly.id.in_(body.ids))
    if body.dari_status != "semua":
        q = q.where(Anomaly.status == body.dari_status)
    rows = db.scalars(q).all()
    for a in rows:
        a.status = body.status
    aksi = (f"review massal dataset {dataset_id}: {len(rows)} anomali -> {body.status} "
            f"(jenis={body.jenis}, kolom={body.kolom})")
    db.add(AuditLog(aksi=aksi[:200]))  # kolom aksi maksimal 200 karakter
    db.commit()
    return {"jumlah_diubah": len(rows), "status_baru": body.status}