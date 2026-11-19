import { QueryClient } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  CleanPreviewResponse,
  CleanReportResponse,
  ColumnDictionaryResponse,
  DashboardSummaryData,
  DashboardTopPendingItem,
  DatasetDetail,
  DatasetListItem,
  DatasetPreviewResponse,
  HistoryLogItem,
  UploadDatasetResponse,
} from '@/types/dataset';

/**
 * Lapisan service dataset dengan integrasi saklar kemampuan backend (BACKEND_CAPABILITIES)
 * dan penanda TODO(B-xx) sesuai Bagian 12 PRD.
 */

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

// B-06: Permintaan pratinjau diff sebelum eksekusi Apply Review (Fase 4)
// TODO(B-06): Tangkap array rincian baris aktual (rows: [...]) yang akan dibuang dari respon preview=true.
export async function getApplyReviewDiff(datasetId: string) {
  const response = await apiClient.post(
    `/datasets/${datasetId}/apply-review?preview=true`
  );
  return response.data;
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

// B-02: Saluran live sync pembaruan real-time
// TODO(B-02): Hubungkan ke WebSocket WS /ws/datasets/{id} atau Server-Sent Events GET /datasets/{id}/events.
// Saat ini menggunakan status pengambilan data React Query ("Data terkini").
