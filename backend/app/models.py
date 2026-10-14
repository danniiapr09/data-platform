from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now():
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    nama: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True)
    role: Mapped[str] = mapped_column(String(20), default="pegawai")  # admin / pegawai
    password_hash: Mapped[str] = mapped_column(String(255))


class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[int] = mapped_column(primary_key=True)
    nama: Mapped[str] = mapped_column(String(150))
    jenis: Mapped[str] = mapped_column(String(50), default="umum")
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    status: Mapped[str] = mapped_column(String(20), default="uploaded")  # uploaded/cleaned/forecasted


class RawData(Base):
    """Data mentah. Tidak pernah diubah setelah disimpan."""
    __tablename__ = "raw_data"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    row_index: Mapped[int] = mapped_column(Integer)
    row_json: Mapped[dict] = mapped_column(JSON)


class CleanData(Base):
    __tablename__ = "clean_data"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    row_index: Mapped[int] = mapped_column(Integer)
    row_json: Mapped[dict] = mapped_column(JSON)


class Anomaly(Base):
    __tablename__ = "anomalies"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    row_index: Mapped[int] = mapped_column(Integer)
    kolom: Mapped[str] = mapped_column(String(100))
    alasan: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/diterima/ditolak
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class ProcessingLog(Base):
    __tablename__ = "processing_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    langkah: Mapped[str] = mapped_column(String(100))
    ringkasan: Mapped[str] = mapped_column(Text)
    waktu: Mapped[datetime] = mapped_column(DateTime, default=now)


class Forecast(Base):
    __tablename__ = "forecasts"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    model: Mapped[str] = mapped_column(String(50))
    periode: Mapped[str] = mapped_column(String(30))
    nilai_prediksi: Mapped[float] = mapped_column(Float)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    mape: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    aksi: Mapped[str] = mapped_column(String(200))
    waktu: Mapped[datetime] = mapped_column(DateTime, default=now)

class DataEdit(Base):
    """Jejak setiap edit manual pada data bersih: siapa, kapan, nilai lama -> baru, dan alasannya."""
    __tablename__ = "data_edits"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(ForeignKey("datasets.id"), index=True)
    versi_baru: Mapped[int] = mapped_column(Integer)
    row_index: Mapped[int] = mapped_column(Integer)
    kolom: Mapped[str] = mapped_column(String(100))
    nilai_lama: Mapped[str | None] = mapped_column(Text, nullable=True)   # disimpan sebagai JSON
    nilai_baru: Mapped[str | None] = mapped_column(Text, nullable=True)   # disimpan sebagai JSON
    alasan: Mapped[str] = mapped_column(Text)
    diubah_oleh: Mapped[str | None] = mapped_column(String(100), nullable=True)
    waktu: Mapped[datetime] = mapped_column(DateTime, default=now)