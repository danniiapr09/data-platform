from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, Dataset

router = APIRouter(tags=["ringkasan"])

STATUS_DATASET = ("uploaded", "cleaned", "forecasted")


@router.get("/ringkasan")
def ringkasan(db: Session = Depends(get_db)):
    """Angka untuk beranda: jumlah dataset per status dan anomali pending di semua dataset."""
    per_status = {s: 0 for s in STATUS_DATASET}
    for status, n in db.execute(select(Dataset.status, func.count()).group_by(Dataset.status)).all():
        per_status[status] = n

    pending_rows = db.execute(
        select(Anomaly.dataset_id, Dataset.nama, func.count())
        .join(Dataset, Dataset.id == Anomaly.dataset_id)
        .where(Anomaly.status == "pending")
        .group_by(Anomaly.dataset_id, Dataset.nama)
        .order_by(func.count().desc(), Anomaly.dataset_id)
    ).all()
    return {
        "jumlah_dataset": sum(per_status.values()),
        "per_status": per_status,
        "anomali_pending": sum(n for _, _, n in pending_rows),
        "dataset_dengan_pending": len(pending_rows),
        "pending_teratas": [{"dataset_id": i, "nama": nama, "pending": n}
                            for i, nama, n in pending_rows[:5]],
    }