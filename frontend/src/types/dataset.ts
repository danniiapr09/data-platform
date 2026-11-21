/**
 * Definisi tipe data entitas dataset, skema kolom, laporan pembersihan, anomali, edit sel,
 * dan ringkasan beranda sesuai kontrak kode backend FastAPI.
 */

export type DatasetProcessingStatus = 'uploaded' | 'cleaned' | 'forecasted';

export type AnomalyStatus = 'diterima' | 'pending' | 'ditolak' | 'diperbaiki';

export type AnomalyReviewActionStatus = 'diterima' | 'ditolak' | 'pending';

export type AnomalyGroupBy = 'jenis' | 'kolom' | 'status' | 'data';

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
  // Field opsional di balik saklar B-04 ketika backend menyertakan row_index eksplisit
  row_indices?: number[];
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

/** Respons dari POST /datasets/{id}/clean */
export interface RunCleanResponse {
  dataset_id: number;
  versi: number;
  laporan: CleanReportResponse;
}

/** Item anomali dari GET /datasets/{id}/anomalies/items atau contoh di summary */
export interface AnomalyItem {
  id: number;
  row_index: number;
  baris_di_file_asli: number;
  kolom: string;
  jenis: string;
  alasan: string;
  status: AnomalyStatus;
}

/** Kelompok anomali pada GET /datasets/{id}/anomalies/summary */
export interface AnomalySummaryGroup {
  kelompok: string;
  jumlah: number;
  pending: number;
  diterima: number;
  ditolak: number;
  diperbaiki: number;
  contoh: AnomalyItem[];
}

/** Respons dari GET /datasets/{id}/anomalies/summary */
export interface AnomalySummaryResponse {
  dataset_id: number;
  group_by: AnomalyGroupBy;
  total: number;
  per_status: {
    pending: number;
    diterima: number;
    ditolak: number;
    diperbaiki: number;
  };
  kelompok: AnomalySummaryGroup[];
  deskripsi: string;
}

/** Respons dari GET /datasets/{id}/anomalies/items */
export interface AnomalyItemsResponse {
  total: number;
  limit: number;
  offset: number;
  data: AnomalyItem[];
}

/** Respons dari PATCH /anomalies/{anomaly_id} */
export interface ReviewSingleAnomalyResponse {
  id: number;
  status: AnomalyReviewActionStatus;
}

/** Payload untuk POST /datasets/{id}/anomalies/review (Bulk Review) */
export interface BulkReviewPayload {
  status: AnomalyReviewActionStatus;
  jenis?: string | null;
  kolom?: string | null;
  ids?: number[] | null;
  semua?: boolean;
  dari_status?: AnomalyStatus | 'semua';
}

/** Respons dari POST /datasets/{id}/anomalies/review */
export interface BulkReviewResponse {
  jumlah_diubah: number;
  status_baru: AnomalyReviewActionStatus;
}

/** Item perubahan sel pada PATCH /datasets/{id}/data */
export interface CellEditInputItem {
  row_index: number;
  kolom: string;
  nilai: string | number | null;
}

/** Payload untuk PATCH /datasets/{id}/data */
export interface PatchDataPayload {
  perubahan: CellEditInputItem[];
  alasan: string;
}

/** Detail perubahan sel pada respons PATCH /datasets/{id}/data */
export interface CellEditResultItem {
  row_index: number;
  baris_di_file_asli: number;
  kolom: string;
  nilai_lama: unknown;
  nilai_baru: unknown;
}

/** Respons dari PATCH /datasets/{id}/data */
export interface PatchDataResponse {
  versi_baru: number;
  jumlah_sel_diubah: number;
  dilewati: number;
  anomali_diperbaiki: number;
  diubah_oleh: string;
  peringatan: string[];
  perubahan: CellEditResultItem[];
}

/** Ringkasan audit edit pada GET /datasets/{id}/edits */
export interface DataEditsSummary {
  jumlah_perubahan: number;
  sel_unik: number;
  baris_unik: number;
  baris_bersih: number;
  persen_baris_diedit: number | null;
  pengedit: string[];
  deskripsi: string;
}

/** Item riwayat edit pada GET /datasets/{id}/edits */
export interface DataEditHistoryItem {
  id: number;
  versi_baru: number;
  row_index: number;
  baris_di_file_asli: number;
  kolom: string;
  nilai_lama: unknown;
  nilai_baru: unknown;
  alasan: string;
  diubah_oleh: string;
  waktu: string;
}

/** Respons dari GET /datasets/{id}/edits */
export interface DataEditsListResponse {
  ringkasan: DataEditsSummary;
  total: number;
  data: DataEditHistoryItem[];
}

/** Respons dari usulan endpoint terpadu GET /datasets/{id}/data-review (B-05) */
export interface UnifiedDataReviewRow {
  row_index: number;
  baris_di_file_asli: number;
  data: Record<string, unknown>;
  anomali: Record<string, AnomalyItem>;
}

export interface UnifiedDataReviewResponse {
  dataset_id: number;
  versi: number;
  total_baris: number;
  limit: number;
  offset: number;
  rows: UnifiedDataReviewRow[];
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

/** Rincian baris yang akan/telah dibuang pada respons POST /datasets/{id}/apply-review */
export interface ApplyReviewDroppedRowDetail {
  row_index: number;
  baris_di_file_asli: number;
  alasan: string[];
  // Field perluasan di balik saklar B-06 (isi baris aktual dari backend)
  kolom?: string[];
  row_json?: Record<string, unknown>;
}

/** Respons dari POST /datasets/{id}/apply-review (?preview=true maupun ?preview=false) */
export interface ApplyReviewResponse {
  dataset_id: number;
  preview: boolean;
  versi_lama: number;
  versi_baru: number | null;
  baris_sebelum: number;
  baris_dibuang: number;
  baris_sesudah: number;
  anomali_ditolak_diterapkan: number;
  anomali_pending: number;
  diterapkan_oleh: string;
  detail_baris_dibuang: ApplyReviewDroppedRowDetail[];
  detail_terpotong: boolean;
  peringatan: string[];
  deskripsi: string;
  // Field opsional di balik saklar B-06 jika backend mengembalikan array rows terpisah
  rows?: Array<{
    row_index: number;
    baris_di_file_asli?: number;
    row_json?: Record<string, unknown>;
    data?: Record<string, unknown>;
    alasan?: string[];
  }>;
}

/**
 * Status hasil evaluasi pratinjau Apply Review untuk mengklasifikasikan
 * anomali ditolak AKTIF vs SUDAH DIBUANG (Penyesuaian Wajib butir c).
 */
export type RejectedAnomaliesClassificationMode =
  | 'exact_from_preview'
  | 'all_already_dropped'
  | 'blocked_all_rows'
  | 'uncertain';

export interface RejectedAnomaliesClassification {
  mode: RejectedAnomaliesClassificationMode;
  /** Himpunan row_index dengan anomali ditolak yang masih AKTIF di versi bersih saat ini */
  activeRejectedRowIndices: Set<number>;
  /** Himpunan row_index dengan anomali ditolak yang SUDAH DIBUANG pada versi sebelumnya */
  alreadyDroppedRowIndices: Set<number>;
  /** Apakah klasifikasi tiap anomali ditolak 100% pasti */
  isCertain: boolean;
  /** Catatan netral atau pesan pemblokiran jika ada */
  message: string | null;
}
