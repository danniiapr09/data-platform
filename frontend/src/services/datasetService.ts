import { QueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  AnomalyGroupBy,
  AnomalyItem,
  AnomalyItemsResponse,
  AnomalyReviewActionStatus,
  AnomalyStatus,
  AnomalySummaryResponse,
  ApplyReviewResponse,
  BulkReviewPayload,
  BulkReviewResponse,
  CleanPreviewResponse,
  CleanReportResponse,
  ColumnDictionaryResponse,
  DashboardSummaryData,
  DashboardTopPendingItem,
  DataEditsListResponse,
  DatasetDetail,
  DatasetListItem,
  DatasetPreviewResponse,
  HistoryLogItem,
  PatchDataPayload,
  PatchDataResponse,
  ReviewSingleAnomalyResponse,
  RunCleanResponse,
  UnifiedDataReviewResponse,
  UploadDatasetResponse,
} from '@/types/dataset';

/**
 * Lapisan service dataset dengan integrasi saklar kemampuan backend (BACKEND_CAPABILITIES)
 * dan penanda TODO(B-xx) sesuai Bagian 12 PRD.
 */

export const MAX_ANOMALIES_BATCH_LOAD = 2000;

// B-08: Mengambil daftar katalog seluruh dataset (GET /datasets)
// TODO(B-08): Manfaatkan metadata format, file_size_bytes, sheet_name, jumlah_baris, jumlah_kolom,
// dan anomali_pending langsung dari GET /datasets ketika saklar B08_CATALOG_EXTENDED_METADATA aktif.
export async function getDatasets(): Promise<DatasetListItem[]> {
  const response = await apiClient.get<DatasetListItem[]>('/datasets');
  return response.data;
}

// Mengambil ringkasan detail satu dataset (GET /datasets/{id})
export async function getDatasetDetail(
  datasetId: number | string
): Promise<DatasetDetail> {
  const response = await apiClient.get<DatasetDetail>(`/datasets/${datasetId}`);
  return response.data;
}

/**
 * Helper pembatas konkurensi maksimal N tugas paralel sekaligus
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < items.length) {
      const currentIdx = index++;
      results[currentIdx] = await worker(items[currentIdx]);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    next()
  );
  await Promise.all(runners);
  return results;
}

// B-01 & B-09: Ringkasan metrik Beranda eksekutif
// TODO(B-01): Aktifkan saklar B01_RINGKASAN_ENDPOINT begitu router ringkasan didaftarkan ke main.py.
// TODO(B-09): Aktifkan saklar B09_GLOBAL_COMPLETENESS_METRIC ketika rata_rata_kelengkapan_persen tersedia.
export async function getDashboardSummary(
  queryClient?: QueryClient
): Promise<DashboardSummaryData> {
  if (BACKEND_CAPABILITIES.B01_RINGKASAN_ENDPOINT) {
    const response = await apiClient.get<DashboardSummaryData>('/ringkasan');
    return response.data;
  }

  // Fallback saat B-01 bernilai false: susun dari GET /datasets + GET /datasets/{id} (maks. 5 paralel)
  const datasets = queryClient
    ? await queryClient.fetchQuery({
        queryKey: ['datasets'],
        queryFn: getDatasets,
        staleTime: 1000 * 30,
      })
    : await getDatasets();

  const per_status = {
    uploaded: 0,
    cleaned: 0,
    forecasted: 0,
  };

  for (const ds of datasets) {
    if (ds.status === 'uploaded') per_status.uploaded += 1;
    else if (ds.status === 'cleaned') per_status.cleaned += 1;
    else if (ds.status === 'forecasted') per_status.forecasted += 1;
  }

  // Dataset berstatus 'uploaded' belum memiliki anomali (anomali baru muncul setelah cleaning)
  const processedDatasets = datasets.filter((d) => d.status !== 'uploaded');

  const details = await runWithConcurrencyLimit(
    processedDatasets,
    5,
    async (ds) => {
      try {
        if (queryClient) {
          return await queryClient.fetchQuery({
            queryKey: ['dataset-detail', String(ds.id)],
            queryFn: () => getDatasetDetail(ds.id),
            staleTime: 1000 * 30,
          });
        }
        return await getDatasetDetail(ds.id);
      } catch {
        return null;
      }
    }
  );

  let anomali_pending = 0;
  let dataset_dengan_pending = 0;
  const pendingItems: DashboardTopPendingItem[] = [];

  for (const detail of details) {
    if (!detail) continue;
    const pendingCount = detail.anomali?.pending || 0;
    if (pendingCount > 0) {
      anomali_pending += pendingCount;
      dataset_dengan_pending += 1;
      pendingItems.push({
        dataset_id: detail.id,
        nama: detail.nama,
        jenis: detail.jenis,
        status: detail.status,
        uploaded_at: detail.uploaded_at,
        pending: pendingCount,
      });
    }
  }

  // Urutkan dari jumlah anomali pending terbanyak, lalu ID terkecil (sesuai ringkasan.py)
  pendingItems.sort((a, b) => b.pending - a.pending || a.dataset_id - b.dataset_id);

  return {
    jumlah_dataset: datasets.length,
    per_status,
    anomali_pending,
    dataset_dengan_pending,
    pending_teratas: pendingItems.slice(0, 5),
    rata_rata_kelengkapan_persen: null,
    terakhir_diperbarui: null,
  };
}

// Unggah dataset baru (POST /datasets/upload)
export async function uploadDataset(params: {
  file: File;
  nama?: string;
  jenis: string;
  onProgress?: (percent: number) => void;
}): Promise<UploadDatasetResponse> {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.nama && params.nama.trim() !== '') {
    formData.append('nama', params.nama.trim());
  }
  formData.append('jenis', params.jenis);

  const response = await apiClient.post<UploadDatasetResponse>(
    '/datasets/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // Waktu ekstra untuk unggah berkas hingga 10 MB
      onUploadProgress: (progressEvent) => {
        if (params.onProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          params.onProgress(percent);
        }
      },
    }
  );
  return response.data;
}

// Pratinjau baris data mentah v0 (GET /datasets/{id}/preview)
export async function getDatasetPreview(
  datasetId: number | string,
  limit = 10
): Promise<DatasetPreviewResponse> {
  const response = await apiClient.get<DatasetPreviewResponse>(
    `/datasets/${datasetId}/preview`,
    { params: { limit } }
  );
  return response.data;
}

// Pratinjau baris data bersih versi terbaru (GET /datasets/{id}/clean-preview)
// TODO(B-04): Pastikan atribut row_index asli database disertakan di setiap baris pada Fase 3.
// TODO(B-05): Alihkan ke endpoint terpadu GET /datasets/{id}/data-review pada Fase 3 ketika backend siap.
export async function getCleanDataPreview(
  datasetId: number | string,
  limit = 10
): Promise<CleanPreviewResponse> {
  const response = await apiClient.get<CleanPreviewResponse>(
    `/datasets/${datasetId}/clean-preview`,
    { params: { limit } }
  );
  return response.data;
}

// Laporan hasil pembersihan terakhir (GET /datasets/{id}/clean-report)
export async function getCleanReport(
  datasetId: number | string
): Promise<CleanReportResponse> {
  const response = await apiClient.get<CleanReportResponse>(
    `/datasets/${datasetId}/clean-report`
  );
  return response.data;
}

// Riwayat linimasa pemrosesan dataset (GET /datasets/{id}/history)
export async function getDatasetHistory(
  datasetId: number | string
): Promise<HistoryLogItem[]> {
  const response = await apiClient.get<HistoryLogItem[]>(
    `/datasets/${datasetId}/history`
  );
  return response.data;
}

// F-11: Eksekusi Pembersihan Otomatis (POST /datasets/{id}/clean)
// Memakai skipErrorToast: true agar konflik HTTP 409 ditangani oleh modal konfirmasi tanpa toast error ganda
export async function runDatasetCleaning(
  datasetId: number | string,
  timpa = false
): Promise<RunCleanResponse> {
  const response = await apiClient.post<RunCleanResponse>(
    `/datasets/${datasetId}/clean`,
    null,
    {
      params: timpa ? { timpa: true } : undefined,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-13: Dashboard Ringkasan Anomali (GET /datasets/{id}/anomalies/summary)
export async function getAnomalySummary(
  datasetId: number | string,
  params?: {
    group_by?: AnomalyGroupBy;
    data_kolom?: string | null;
    status?: AnomalyStatus | null;
  }
): Promise<AnomalySummaryResponse> {
  const queryParams: Record<string, string> = {};
  if (params?.group_by) queryParams.group_by = params.group_by;
  if (params?.group_by === 'data' && params?.data_kolom) {
    queryParams.data_kolom = params.data_kolom;
  }
  if (params?.status) queryParams.status = params.status;

  const response = await apiClient.get<AnomalySummaryResponse>(
    `/datasets/${datasetId}/anomalies/summary`,
    { params: queryParams }
  );
  return response.data;
}

// F-14: Daftar Item Anomali dengan Filter & Paginasi Server (GET /datasets/{id}/anomalies/items)
export async function getAnomalyItems(
  datasetId: number | string,
  params?: {
    jenis?: string | null;
    kolom?: string | null;
    status?: AnomalyStatus | null;
    limit?: number;
    offset?: number;
  }
): Promise<AnomalyItemsResponse> {
  const queryParams: Record<string, string | number> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  };
  if (params?.jenis) queryParams.jenis = params.jenis;
  if (params?.kolom) queryParams.kolom = params.kolom;
  if (params?.status) queryParams.status = params.status;

  const response = await apiClient.get<AnomalyItemsResponse>(
    `/datasets/${datasetId}/anomalies/items`,
    { params: queryParams }
  );
  return response.data;
}

/**
 * Memuat item anomali dataset hingga maksimal MAX_ANOMALIES_BATCH_LOAD (2.000 item).
 * Jika total anomali > 2.000, mengembalikan `isTruncated: true` agar UI beralih ke paginasi/filter server.
 */
export async function getBoundedAnomalyItems(
  datasetId: number | string,
  filters?: {
    jenis?: string | null;
    kolom?: string | null;
    status?: AnomalyStatus | null;
  }
): Promise<{
  items: AnomalyItem[];
  total: number;
  isTruncated: boolean;
}> {
  const pageSize = 500; // Batas maksimum per request di anomalies.py: min(max(limit, 1), 500)
  const firstPage = await getAnomalyItems(datasetId, {
    ...filters,
    limit: pageSize,
    offset: 0,
  });

  const collected: AnomalyItem[] = [...firstPage.data];
  const total = firstPage.total;
  const maxToLoad = Math.min(total, MAX_ANOMALIES_BATCH_LOAD);

  let currentOffset = pageSize;
  while (collected.length < maxToLoad && currentOffset < maxToLoad) {
    const nextPage = await getAnomalyItems(datasetId, {
      ...filters,
      limit: Math.min(pageSize, maxToLoad - currentOffset),
      offset: currentOffset,
    });
    if (nextPage.data.length === 0) break;
    collected.push(...nextPage.data);
    currentOffset += pageSize;
  }

  return {
    items: collected,
    total,
    isTruncated: total > MAX_ANOMALIES_BATCH_LOAD,
  };
}

// F-15: Verifikasi Individual Anomali: Terima / Tolak / Kembalikan ke Pending (PATCH /anomalies/{anomaly_id})
export async function patchAnomalyStatus(
  anomalyId: number,
  status: AnomalyReviewActionStatus
): Promise<ReviewSingleAnomalyResponse> {
  const response = await apiClient.patch<ReviewSingleAnomalyResponse>(
    `/anomalies/${anomalyId}`,
    { status }
  );
  return response.data;
}

// F-16: Verifikasi Massal / Bulk Review (POST /datasets/{id}/anomalies/review)
export async function postBulkAnomalyReview(
  datasetId: number | string,
  payload: BulkReviewPayload
): Promise<BulkReviewResponse> {
  const response = await apiClient.post<BulkReviewResponse>(
    `/datasets/${datasetId}/anomalies/review`,
    payload
  );
  return response.data;
}

// F-15 & F-19: Edit Nilai Sel via Popover Inline Editor (PATCH /datasets/{id}/data)
export async function patchDatasetCells(
  datasetId: number | string,
  payload: PatchDataPayload
): Promise<PatchDataResponse> {
  const response = await apiClient.patch<PatchDataResponse>(
    `/datasets/${datasetId}/data`,
    payload
  );
  return response.data;
}

// F-20: Riwayat Perubahan Data / Audit Log (GET /datasets/{id}/edits)
export async function getDatasetEdits(
  datasetId: number | string,
  params?: {
    row_index?: number | null;
    kolom?: string | null;
    limit?: number;
    offset?: number;
  }
): Promise<DataEditsListResponse> {
  const queryParams: Record<string, string | number> = {
    limit: params?.limit ?? 100,
    offset: params?.offset ?? 0,
  };
  if (params?.row_index !== undefined && params?.row_index !== null) {
    queryParams.row_index = params.row_index;
  }
  if (params?.kolom) {
    queryParams.kolom = params.kolom;
  }

  const response = await apiClient.get<DataEditsListResponse>(
    `/datasets/${datasetId}/edits`,
    { params: queryParams }
  );
  return response.data;
}

// B-05: Endpoint Grid Data Terpadu dengan Penanda Anomali per Sel
// TODO(B-05): Aktifkan saklar B05_UNIFIED_DATA_REVIEW_ENDPOINT ketika GET /datasets/{id}/data-review tersedia di backend.
export async function getUnifiedDataReview(
  datasetId: number | string,
  params?: {
    limit?: number;
    offset?: number;
    status?: AnomalyStatus | null;
    jenis?: string | null;
    kolom?: string | null;
    q?: string | null;
  }
): Promise<UnifiedDataReviewResponse | null> {
  if (!BACKEND_CAPABILITIES.B05_UNIFIED_DATA_REVIEW_ENDPOINT) {
    return null;
  }
  const response = await apiClient.get<UnifiedDataReviewResponse>(
    `/datasets/${datasetId}/data-review`,
    { params }
  );
  return response.data;
}

// B-03: Profil skema kolom permanen dan deskripsi kamus data
// TODO(B-03): Aktifkan saklar B03_COLUMN_DICTIONARY_ENDPOINT ketika GET /datasets/{id}/columns tersedia di backend.
export async function getDatasetColumnDictionary(
  datasetId: number | string
): Promise<ColumnDictionaryResponse | null> {
  if (!BACKEND_CAPABILITIES.B03_COLUMN_DICTIONARY_ENDPOINT) {
    return null;
  }
  const response = await apiClient.get<ColumnDictionaryResponse>(
    `/datasets/${datasetId}/columns`
  );
  return response.data;
}

// B-10: Unduhan berkas CSV utuh untuk data mentah (v0) dan data bersih
// TODO(B-10): Aktifkan saklar B10_FULL_CSV_EXPORT_ENDPOINT ketika endpoint export/raw.csv dan clean.csv tersedia.
export function getExportCsvUrl(
  datasetId: number | string,
  type: 'raw' | 'clean'
): string | null {
  if (!BACKEND_CAPABILITIES.B10_FULL_CSV_EXPORT_ENDPOINT) {
    return null;
  }
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  return `${base}/datasets/${datasetId}/export/${type}.csv`;
}

// F-17 & B-06: Terapkan Hasil Review (POST /datasets/{id}/apply-review)
// Memakai skipErrorToast: true agar kode status 400 ("Tidak ada baris..." atau "Semua baris akan terbuang...")
// ditangani secara spesifik di dalam modal dan klasifikasi anomali ditolak tanpa memicu toast error ganda.
// TODO(B-06): Aktifkan saklar B06_APPLY_REVIEW_DIFF_ROWS ketika backend menyertakan row_json/rows pada preview=true.
export async function postApplyReview(
  datasetId: number | string,
  preview: boolean
): Promise<ApplyReviewResponse> {
  const response = await apiClient.post<ApplyReviewResponse>(
    `/datasets/${datasetId}/apply-review`,
    null,
    {
      params: { preview },
      skipErrorToast: true,
    }
  );
  return response.data;
}

export async function getApplyReviewDiff(
  datasetId: number | string
): Promise<ApplyReviewResponse> {
  return postApplyReview(datasetId, true);
}

// B-07: Agregasi hierarki dan matriks 2D untuk galeri diagram (Fase 5)
// TODO(B-07): Panggil endpoint khusus GET /datasets/{id}/analysis/hierarchy & matrix jika telah diimplementasikan backend.
export async function getHierarchyData(datasetId: string) {
  const response = await apiClient.get(`/datasets/${datasetId}/eda`);
  return response.data;
}

// B-11: Autentikasi mandiri kredensial pegawai instansi (Fase 8)
// TODO(B-11): Hubungkan ke endpoint POST /auth/login dan GET /auth/me saat fase autentikasi dimulai.
export async function loginOfficer() {
  return Promise.resolve({ user: 'pegawai_instansi', role: 'admin' });
}
