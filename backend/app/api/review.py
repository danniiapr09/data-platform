from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anomaly, AuditLog, CleanData, Dataset, Forecast, ProcessingLog
from ..security import Actor, get_actor

router = APIRouter(prefix="/datasets/{dataset_id}", tags=["review"])

MAKS_DETAIL = 200  # jumlah baris yang dirinci di respons


@router.post("/apply-review")
def apply_review(dataset_id: int, preview: bool = False, actor: Actor = Depends(get_actor),
                 db: Session = Depends(get_db)):
    """Terapkan hasil review: baris yang anomalinya berstatus 'ditolak' dibuang dari data bersih.

    Hasilnya jadi versi data bersih baru; versi lama dan data mentah tetap tersimpan.
    Pakai ?preview=true untuk melihat dampaknya tanpa mengubah apa pun.
    """
    if not db.get(Dataset, dataset_id):
        raise HTTPException(404, "Dataset tidak ditemukan.")
    version = db.scalar(select(func.max(CleanData.version)).where(CleanData.dataset_id == dataset_id))
    if not version:
        raise HTTPException(400, "Dataset belum di-cleaning. Jalankan cleaning dulu.")
    rows = db.scalars(select(CleanData).where(CleanData.dataset_id == dataset_id,
                                              CleanData.version == version)
                      .order_by(CleanData.row_index)).all()

    anomalies = db.scalars(select(Anomaly).where(Anomaly.dataset_id == dataset_id)).all()
    alasan_by_row: dict = {}
    for a in anomalies:
        if a.status == "ditolak":
            alasan_by_row.setdefault(a.row_index, []).append(a.alasan)
    ada = {r.row_index for r in rows}
    buang = sorted(i for i in alasan_by_row if i in ada)
    if not buang:
        raise HTTPException(400, "Tidak ada baris dengan anomali berstatus 'ditolak' yang perlu diterapkan.")
    if len(buang) >= len(rows):
        raise HTTPException(400, "Semua baris akan terbuang. Periksa kembali status anomali.")
    buang_set = set(buang)
    pending = sum(1 for a in anomalies if a.status == "pending" and a.row_index not in buang_set)
    ada_forecast = db.scalar(select(func.count()).select_from(Forecast)
                             .where(Forecast.dataset_id == dataset_id)) > 0

    sisa = len(rows) - len(buang)
    new_version = None if preview else version + 1
    target = version + 1
    peringatan = []
    if pending:
        peringatan.append(f"{pending} anomali masih pending dan tidak disentuh.")
    if ada_forecast:
        peringatan.append("Hasil forecast sebelumnya dihitung dari data sebelum review diterapkan. "
                          "Jalankan ulang forecast.")

    if not preview:
        db.bulk_insert_mappings(CleanData, [
            {"dataset_id": dataset_id, "version": target, "row_index": r.row_index, "row_json": dict(r.row_json)}
            for r in rows if r.row_index not in buang_set])
        pengguna = actor.user or "tidak diketahui"
        daftar = ",".join(str(i) for i in buang[:20]) + (",..." if len(buang) > 20 else "")
        db.add(ProcessingLog(dataset_id=dataset_id, langkah="apply_review",
                             ringkasan=f"v{version}->v{target}: {len(buang)} baris dibuang (row_index {daftar}) "
                                       f"oleh {pengguna}"))
        db.add(AuditLog(aksi=f"apply review dataset {dataset_id} v{target}: {len(buang)} baris dibuang "
                             f"oleh {pengguna}"[:200]))
        db.commit()

    return {
        "dataset_id": dataset_id,
        "preview": preview,
        "versi_lama": version,
        "versi_baru": new_version,
        "baris_sebelum": len(rows),
        "baris_dibuang": len(buang),
        "baris_sesudah": sisa,
        "anomali_ditolak_diterapkan": sum(len(alasan_by_row[i]) for i in buang),
        "anomali_pending": pending,
        "diterapkan_oleh": actor.user or "tidak diketahui",
        "detail_baris_dibuang": [{"row_index": i, "baris_di_file_asli": i + 2, "alasan": alasan_by_row[i]}
                                 for i in buang[:MAKS_DETAIL]],
        "detail_terpotong": len(buang) > MAKS_DETAIL,
        "peringatan": peringatan,
        "deskripsi": (f"{'Akan membuang' if preview else 'Membuang'} {len(buang)} baris karena anomalinya ditolak. "
                      f"Data bersih versi {target} {'akan berisi' if preview else 'berisi'} {sisa} baris "
                      f"(versi {version} tetap tersimpan)."),
    }