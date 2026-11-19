/**
 * Definisi tipe data entitas dataset, skema kolom, laporan pembersihan, dan ringkasan beranda
 * sesuai kontrak kode backend FastAPI.
 */

export type DatasetProcessingStatus = 'uploaded' | 'cleaned' | 'forecasted';

export type AnomalyStatus = 'diterima' | 'pending' | 'ditolak' | 'diperbaiki';

/** Item dari GET /datasets */
export interface DatasetListItem {
  id: number;
  nama: string;
  jenis: string;
  status: DatasetProcessingStatus;
  uploaded_at: string;
  // Field perluasan di balik saklar B-08 (belum diverifikasi dengan backend)
  format?: string;
  file_size_bytes?: number;
  sheet_name?: string | null;
  jumlah_baris?: number;
  jumlah_kolom?: number;
  anomali_pending?: number;
}

/** Detail dari GET /datasets/{id} */
export interface DatasetDetail {
  id: number;
  nama: string;
  jenis: string;
  status: DatasetProcessingStatus;
  uploaded_at: string;
  baris_mentah: number;
  versi_bersih: number | null;
  baris_bersih: number;
  anomali: Record<string, number>;
  ada_forecast: boolean;
  jumlah_edit_manual: number;
  jumlah_review_diterapkan: number;
  cleaning_ulang_butuh_konfirmasi: boolean;
}

/** Profil tiap kolom dari POST /datasets/upload (atau GET /datasets/{id}/columns pada B-03) */
export interface ColumnProfileItem {
  kolom: string;
  tipe: string;
  kosong: number;
  unik: number;
  contoh: string[];
  deskripsi?: string | null;
}

/** Respons dari POST /datasets/upload */
export interface UploadDatasetResponse {
  dataset_id: number;
  nama: string;
  jumlah_baris: number;
  jumlah_kolom: number;
  kolom: ColumnProfileItem[];
  preview: Array<Record<string, unknown>>;
}

/** Respons dari GET /datasets/{id}/preview */
export interface DatasetPreviewResponse {
  dataset_id: number;
  nama: string;
  total_baris: number;
  preview: Array<Record<string, unknown>>;
}

/** Respons dari GET /datasets/{id}/clean-preview */
export interface CleanPreviewResponse {
  dataset_id: number;
  versi: number;
  preview: Array<Record<string, unknown>>;
}

/** Respons dari GET /datasets/{id}/clean-report */
export interface CleanReportResponse {
  baris_awal: number;
  baris_akhir: number;
  duplikat_ditemukan: number;
  duplikat_dihapus: number;
  kosong_per_kolom: Record<string, number>;
  kolom_diubah_ke_numerik: string[];
  anomali_total: number;
  anomali_per_jenis: Record<string, number>;
  kelengkapan_persen: number;
  aturan: Record<string, unknown>;
}

/** Item dari GET /datasets/{id}/history */
export interface HistoryLogItem {
  langkah: string;
  ringkasan: string;
  waktu: string;
}

/** Item dataset anomali pending teratas untuk tabel Beranda (F-02) */
export interface DashboardTopPendingItem {
  dataset_id: number;
  nama: string;
  jenis?: string;
  status?: DatasetProcessingStatus;
  uploaded_at?: string;
  pending: number;
}

/** Struktur data ringkasan Beranda (F-01 & F-02) */
export interface DashboardSummaryData {
  jumlah_dataset: number;
  per_status: {
    uploaded: number;
    cleaned: number;
    forecasted: number;
  };
  anomali_pending: number;
  dataset_dengan_pending: number;
  pending_teratas: DashboardTopPendingItem[];
  // Field perluasan di balik saklar B-09
  rata_rata_kelengkapan_persen?: number | null;
  terakhir_diperbarui?: string | null;
}

/** Respons dari usulan endpoint GET /datasets/{id}/columns (B-03) */
export interface ColumnDictionaryResponse {
  dataset_id: number;
  versi: number;
  kolom: ColumnProfileItem[];
}
