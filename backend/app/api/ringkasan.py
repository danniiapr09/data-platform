from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, DataEdit, Dataset, ProcessingLog
from .reports import get_clean_report

router = APIRouter(tags=["ringkasan"])

STATUS_DATASET = ("uploaded", "cleaned", "forecasted")


def _iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


@router.get("/ringkasan")
def ringkasan(db: Session = Depends(get_db)):
    """Angka untuk beranda: jumlah dataset per status, anomali pending, kelengkapan data, dan 5 dataset teratas."""
    datasets = db.scalars(select(Dataset)).all()
    by_id = {d.id: d for d in datasets}

    per_status = {s: 0 for s in STATUS_DATASET}
    for d in datasets:
        per_status[d.status] = per_status.get(d.status, 0) + 1

    pending_rows = db.execute(
        select(Anomaly.dataset_id, Dataset.nama, func.count())
        .join(Dataset, Dataset.id == Anomaly.dataset_id)
        .where(Anomaly.status == "pending")
        .group_by(Anomaly.dataset_id, Dataset.nama)
        .order_by(func.count().desc(), Anomaly.dataset_id)
    ).all()
    total_pending = sum(n for _, _, n in pending_rows)

    log_terakhir = dict(db.execute(select(ProcessingLog.dataset_id, func.max(ProcessingLog.waktu))
                                   .group_by(ProcessingLog.dataset_id)).all())
    edit_terakhir = dict(db.execute(select(DataEdit.dataset_id, func.max(DataEdit.waktu))
                                    .group_by(DataEdit.dataset_id)).all())

    def diperbarui(d):
        return max(t for t in (d.uploaded_at, log_terakhir.get(d.id), edit_terakhir.get(d.id)) if t)

    kelengkapan = []
    for d in datasets:
        if d.status in ("cleaned", "forecasted"):
            k = (get_clean_report(db, d.id) or {}).get("kelengkapan_persen")
            if k is not None:
                kelengkapan.append(k)
    rata = round(sum(kelengkapan) / len(kelengkapan), 1) if kelengkapan else None

    return {
        # format untuk frontend
        "total_datasets": len(datasets),
        "status_counts": per_status,
        "total_anomalies_pending": total_pending,
        "rata_rata_kelengkapan": rata,
        "rata_rata_kelengkapan_persen": rata,
        "last_sync_timestamp": _iso(max((diperbarui(d) for d in datasets), default=None)),
        "top_pending_anomalies": [{
            "dataset_id": i,
            "dataset_nama": nama,
            "jenis_data": by_id[i].jenis,
            "status": by_id[i].status,
            "pending_count": n,
            "updated_at": _iso(diperbarui(by_id[i])),
        } for i, nama, n in pending_rows[:5]],
        # kunci lama, dipertahankan supaya pemanggil yang sudah ada tidak rusak
        "jumlah_dataset": len(datasets),
        "per_status": per_status,
        "anomali_pending": total_pending,
        "dataset_dengan_pending": len(pending_rows),
        "pending_teratas": [{"dataset_id": i, "nama": nama, "pending": n} for i, nama, n in pending_rows[:5]],
    }