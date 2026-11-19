import { apiClient } from './apiClient';
import { DatasetItem } from '@/types/dataset';

/**
 * Service dataset dengan penanda TODO(B-xx) sesuai Bagian 12 PRD.
 * Menghubungkan endpoint backend FastAPI dan menyiapkan fallback aman.
 */

// B-01: Ringkasan metrik Beranda eksekutif (GET /ringkasan)
// TODO(B-01): Aktifkan panggilan ini begitu backend mendaftarkan router ringkasan ke main.py.
// TODO(B-09): Integrasikan field kelengkapan global dan timestamp pembaruan terakhir.
export async function getDashboardSummary() {
  const response = await apiClient.get('/ringkasan');
  return response.data;
}

// B-08: Mengambil daftar katalog dataset (GET /datasets)
// TODO(B-08): Manfaatkan metadata file_size_bytes, sheet_name, dan total anomali pending ketika backend siap.
export async function getDatasets(): Promise<DatasetItem[]> {
  const response = await apiClient.get<DatasetItem[]>('/datasets');
  return response.data;
}

// B-03: Profil skema kolom dan deskripsi kamus data
// TODO(B-03): Panggil endpoint GET /datasets/{id}/columns jika backend telah menyediakannya.
// Saat ini fallback menggunakan kalkulasi profil di sisi klien dari pratinjau data.
export async function getDatasetColumns(datasetId: string) {
  const response = await apiClient.get(`/datasets/${datasetId}/preview?limit=10`);
  return response.data;
}

// B-04 & B-05: Grid data terpadu dan verifikasi penanda anomali
// TODO(B-04): Pastikan atribut row_index asli database dipetakan ke sel data bersih.
// TODO(B-05): Alihkan ke endpoint terpadu GET /datasets/{id}/data-review ketika backend siap.
export async function getCleanDataPreview(datasetId: string, limit = 50) {
  const response = await apiClient.get(`/datasets/${datasetId}/clean-preview?limit=${limit}`);
  return response.data;
}

// B-06: Permintaan pratinjau diff sebelum eksekusi Apply Review
// TODO(B-06): Tangkap array rincian baris aktual (rows: [...]) yang akan dibuang dari respon preview=true.
export async function getApplyReviewDiff(datasetId: string) {
  const response = await apiClient.post(`/datasets/${datasetId}/apply-review?preview=true`);
  return response.data;
}

// B-07: Agregasi hierarki dan matriks 2D untuk galeri diagram
// TODO(B-07): Panggil endpoint khusus GET /datasets/{id}/analysis/hierarchy & matrix jika telah diimplementasikan backend.
export async function getHierarchyData(datasetId: string) {
  const response = await apiClient.get(`/datasets/${datasetId}/eda`);
  return response.data;
}

// B-10: Unduhan berkas CSV utuh data mentah dan data bersih
// TODO(B-10): Hubungkan ke endpoint resmi GET /datasets/{id}/export/raw.csv dan clean.csv.
export function getExportCsvUrl(datasetId: string, type: 'raw' | 'clean'): string {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${base}/datasets/${datasetId}/export/${type}.csv`;
}

// B-11: Autentikasi mandiri kredensial pegawai instansi
// TODO(B-11): Hubungkan ke endpoint POST /auth/login dan GET /auth/me saat fase autentikasi dimulai.
export async function loginOfficer() {
  // Placeholder untuk Fase 8
  return Promise.resolve({ user: 'pegawai_instansi', role: 'admin' });
}

// B-02: Saluran live sync pembaruan real-time
// TODO(B-02): Hubungkan ke WebSocket WS /ws/datasets/{id} atau Server-Sent Events GET /datasets/{id}/events.
// Fallback saat ini menggunakan polling otomatis via React Query (refetchInterval).
