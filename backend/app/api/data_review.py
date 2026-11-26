from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import AppError
from ..models import Anomaly, CleanData
from .reports import get_dataset_or_404

router = APIRouter(prefix="/datasets/{dataset_id}/datareview", tags=["data-review"])

STATUSES = ("pending", "diterima", "ditolak", "diperbaiki")
# Kalau satu sel punya lebih dari satu anomali, yang ditampilkan: pending dulu, diterima paling akhir.
PRIORITY = {"pending": 0, "ditolak": 1, "diperbaiki": 2, "diterima": 3}


def _anomaly(a: Anomaly | None):
    if a is None:
        return None
    return {"id": a.id, "jenis": None, "status": a.status, "pesan": a.alasan}


def _sort_key(v):
    if isinstance(v, (bool, int, float)):
        return (0, float(v), "")
    return (1, 0.0, str(v).lower())


def _sort_rows(rows, col: str, desc: bool):
    filled = [r for r in rows if r.row_json.get(col) is not None]
    empty = [r for r in rows if r.row_json.get(col) is None]       # sel kosong selalu di bawah
    filled.sort(key=lambda r: (_sort_key(r.row_json[col]), r.row_index), reverse=desc)
    return filled + empty


@router.get("")
def data_review(
    dataset_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    status_anomali: str = "all",   # all | any | pending | diterima | ditolak | diperbaiki
    sort_by: str = "row_index",    # row_index atau nama kolom data
    order: str = "asc",
    db: Session = Depends(get_db),
):
    get_dataset_or_404(db, dataset_id)
    if status_anomali not in ("all", "any", *STATUSES):
        raise AppError(422, "INVALID_FILTER", "Nilai status_anomali tidak dikenal.",
                       detail="Gunakan: all, any, pending, diterima, ditolak, atau diperbaiki.",
                       field="status_anomali")
    if order not in ("asc", "desc"):
        raise AppError(422, "INVALID_ORDER", "Nilai order harus asc atau desc.", field="order")

    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    if not version:
        raise AppError(400, "DATASET_NOT_CLEANED", "Dataset belum di-cleaning.",
                       detail="Jalankan cleaning dulu sebelum membuka review data.")

    base = select(CleanData).where(CleanData.dataset_id == dataset_id, CleanData.version == version)
    first = db.scalars(base.order_by(CleanData.row_index).limit(1)).first()
    columns = list(first.row_json) if first else []

    if sort_by != "row_index" and sort_by not in columns:
        raise AppError(422, "INVALID_SORT", f"Kolom '{sort_by}' tidak ada di dataset ini.", field="sort_by")

    if status_anomali != "all":
        sub = select(Anomaly.row_index).where(Anomaly.dataset_id == dataset_id)
        if status_anomali != "any":
            sub = sub.where(Anomaly.status == status_anomali)
        base = base.where(CleanData.row_index.in_(sub))

    total = db.scalar(select(func.count()).select_from(base.subquery()))
    desc = order == "desc"
    offset = (page - 1) * limit

    if sort_by == "row_index":
        urut = CleanData.row_index.desc() if desc else CleanData.row_index.asc()
        rows = db.scalars(base.order_by(urut).offset(offset).limit(limit)).all()
    else:
        semua = db.scalars(base.order_by(CleanData.row_index)).all()
        rows = _sort_rows(semua, sort_by, desc)[offset:offset + limit]

    anom_by_cell: dict = {}
    idx = [r.row_index for r in rows]
    if idx:
        for a in db.scalars(select(Anomaly).where(Anomaly.dataset_id == dataset_id,
                                                  Anomaly.row_index.in_(idx))).all():
            cur = anom_by_cell.get((a.row_index, a.kolom))
            if cur is None or PRIORITY.get(a.status, 9) < PRIORITY.get(cur.status, 9):
                anom_by_cell[(a.row_index, a.kolom)] = a

    return {
        "dataset_id": dataset_id,
        "version": version,
        "page": page,
        "limit": limit,
        "total_rows": total,
        "total_pages": -(-total // limit),
        "columns": columns,
        "data": [{
            "row_index": r.row_index,
            "cells": {k: {"value": v, "anomaly": _anomaly(anom_by_cell.get((r.row_index, k)))}
                      for k, v in r.row_json.items()},
        } for r in rows],
    }