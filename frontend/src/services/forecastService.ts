import { apiClient } from './apiClient';
import {
  BlobDownloadResult,
  ForecastPostResponse,
  ForecastReportResponse,
  ForecastRequestPayload,
  ForecastSavedRowItem,
} from '@/types/forecast';

/**
 * Lapisan service untuk Tab 4: Peramalan & Ekspor (Fase 6: F-26 s/d F-31).
 *
 * Ketentuan teknis:
 * - Timeout khusus 60.000 ms (60 detik) HANYA untuk panggilan perhitungan peramalan
 *   dan unduhan berkas Excel (.xlsx) / CSV (.csv).
 * - Seluruh unduhan wajib melalui `apiClient` (`responseType: 'blob'`) agar header
 *   autentikasi (`X-API-Key`, `X-User`, `X-Role`) selalu terkirim.
 * - Mendukung pembacaan nama berkas dari `Content-Disposition` (termasuk `filename*`)
 *   dengan pembersihan pemisah path, pembatasan panjang maksimal 80 karakter, dan
 *   fallback deterministik (`laporan_dataset_{id}.xlsx` / `forecast_dataset_{id}.csv`)
 *   ketika CORS backend belum menyertakan `expose_headers=["Content-Disposition"]` (B-14).
 * - Membaca pesan error JSON yang terbungkus di dalam `Blob` ketika unduhan gagal,
 *   serta membebaskan `URL.revokeObjectURL` segera setelah unduhan selesai.
 */

const FORECAST_AND_EXPORT_TIMEOUT_MS = 60000;
const MAX_DOWNLOAD_FILENAME_LENGTH = 80;

/**
 * Membersihkan nama berkas dari karakter pemisah path (/ dan \), traversal (..),
 * karakter kontrol, serta membatasi panjang maksimal 80 karakter dengan menjaga ekstensi.
 */
export function sanitizeDownloadFilename(
  rawName: string | null | undefined,
  fallbackFilename: string
): string {
  const candidate = String(rawName || '').trim();
  if (!candidate) {
    return fallbackFilename;
  }

  // Ambil hanya segmen nama berkas terakhir (buang path Windows/POSIX)
  const baseSegment = candidate
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.trim();

  if (!baseSegment) {
    return fallbackFilename;
  }

  // Bersihkan karakter berbahaya sistem berkas dan urutan titik ganda
  const cleaned = baseSegment
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');

  if (!cleaned) {
    return fallbackFilename;
  }

  if (cleaned.length <= MAX_DOWNLOAD_FILENAME_LENGTH) {
    return cleaned;
  }

  // Pertahankan ekstensi jika panjang melebihi batas
  const dotIdx = cleaned.lastIndexOf('.');
  if (dotIdx > 0 && cleaned.length - dotIdx <= 10) {
    const ext = cleaned.slice(dotIdx);
    const stemMax = Math.max(10, MAX_DOWNLOAD_FILENAME_LENGTH - ext.length);
    return `${cleaned.slice(0, stemMax).replace(/_+$/g, '')}${ext}`;
  }

  return cleaned.slice(0, MAX_DOWNLOAD_FILENAME_LENGTH);
}

/**
 * Mengekstrak nama berkas dari header `Content-Disposition` (mendukung RFC 5987 `filename*`
 * maupun `filename="..."`).
 * // TODO(B-14): Tambahkan expose_headers=["Content-Disposition"] pada CORSMiddleware di backend/app/main.py
 * // agar browser mengizinkan pembacaan header Content-Disposition lintas origin.
 */
export function extractFilenameFromContentDisposition(
  contentDisposition: string | null | undefined,
  fallbackFilename: string
): string {
  if (!contentDisposition || typeof contentDisposition !== 'string') {
    return fallbackFilename;
  }

  // 1. Prioritaskan filename* (RFC 5987 / RFC 6266, mis. filename*=UTF-8''laporan_dataset_1.xlsx)
  const filenameStarMatch = contentDisposition.match(
    /filename\*\s*=\s*(?:UTF-8''|utf-8''|[^']*''|)([^;\r\n]+)/i
  );
  if (filenameStarMatch && filenameStarMatch[1]) {
    const rawStar = filenameStarMatch[1].trim().replace(/^["']|["']$/g, '');
    try {
      const decoded = decodeURIComponent(rawStar);
      return sanitizeDownloadFilename(decoded, fallbackFilename);
    } catch {
      return sanitizeDownloadFilename(rawStar, fallbackFilename);
    }
  }

  // 2. Periksa filename="..." atau filename=...
  const filenameMatch = contentDisposition.match(
    /filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\r\n]+))/i
  );
  if (filenameMatch) {
    const rawStandard = (
      filenameMatch[1] ||
      filenameMatch[2] ||
      filenameMatch[3] ||
      ''
    ).trim();
    if (rawStandard) {
      return sanitizeDownloadFilename(rawStandard, fallbackFilename);
    }
  }

  return fallbackFilename;
}

/**
 * Membaca pesan error yang jelas apabila permintaan `responseType: 'blob'` gagal
 * (baik karena respons error berupa Blob berisi JSON `{"detail": "..."}`, maupun koneksi terputus).
 */
export async function extractBlobErrorMessage(
  error: unknown,
  defaultMessage: string
): Promise<string> {
  const axiosErr = error as {
    code?: string;
    message?: string;
    localizedMessage?: string;
    response?: {
      status?: number;
      data?: unknown;
    };
  };

  if (!axiosErr?.response) {
    if (axiosErr?.code === 'ECONNABORTED') {
      return 'Waktu tunggu permintaan habis (timeout 60 detik). Dataset mungkin berukuran sangat besar atau server sedang sibuk.';
    }
    return (
      axiosErr?.localizedMessage ||
      'Koneksi ke server backend terputus. Pastikan server backend sedang aktif.'
    );
  }

  const status = axiosErr.response.status;
  const data = axiosErr.response.data;

  // Jika body error berupa Blob, baca teksnya dan parse JSON detail dari backend
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text();
      if (text && text.trim()) {
        try {
          const parsed = JSON.parse(text) as { detail?: unknown };
          if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
            return parsed.detail.trim();
          }
          if (Array.isArray(parsed?.detail)) {
            return 'Parameter permintaan tidak valid (422). Silakan periksa kembali nilai input.';
          }
        } catch {
          // Jika bukan JSON tetapi teks pendek dari server
          if (text.length < 240 && !text.trim().startsWith('<')) {
            return text.trim();
          }
        }
      }
    } catch {
      // Lanjut ke fallback status HTTP di bawah
    }
  } else if (
    data &&
    typeof data === 'object' &&
    'detail' in data &&
    typeof (data as { detail?: unknown }).detail === 'string'
  ) {
    return String((data as { detail: string }).detail);
  }

  if (status === 401) {
    return (
      axiosErr.localizedMessage ||
      'Autentikasi gagal (401): Kunci API tidak cocok atau belum dikonfigurasi.'
    );
  }
  if (status === 404) {
    return 'Data atau hasil peramalan belum tersedia di server backend (404).';
  }
  if (status === 400) {
    return 'Syarat unduhan belum terpenuhi (400). Pastikan dataset sudah melalui proses pembersihan.';
  }

  return axiosErr.localizedMessage || defaultMessage;
}

/**
 * Memicu penyimpanan Blob di browser dan membebaskan Object URL setelah selesai.
 */
function triggerBrowserBlobSave(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 250);
  }
}

// F-26: Menjalankan perhitungan peramalan deret waktu (POST /datasets/{id}/forecast)
// Memakai skipErrorToast: true agar error 400 backend tampil di dalam kartu form tanpa toast ganda.
export async function runDatasetForecast(
  datasetId: number | string,
  payload: ForecastRequestPayload
): Promise<ForecastPostResponse> {
  const body: Record<string, unknown> = {
    nilai: payload.nilai,
    agg: payload.agg,
    horizon: payload.horizon,
  };
  if (payload.waktu && payload.waktu.trim() !== '') {
    body.waktu = payload.waktu.trim();
  }
  if (
    payload.test_size !== undefined &&
    payload.test_size !== null &&
    !Number.isNaN(payload.test_size)
  ) {
    body.test_size = payload.test_size;
  }

  const response = await apiClient.post<ForecastPostResponse>(
    `/datasets/${datasetId}/forecast`,
    body,
    {
      timeout: FORECAST_AND_EXPORT_TIMEOUT_MS,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-28 & F-29: Memuat laporan lengkap peramalan tersimpan tanpa menghitung ulang (GET /datasets/{id}/forecast/laporan)
// Jika backend mengembalikan 404 ("Belum ada hasil forecast untuk dataset ini."), kembalikan null.
export async function getSavedForecastReport(
  datasetId: number | string,
  signal?: AbortSignal
): Promise<ForecastReportResponse | null> {
  try {
    const response = await apiClient.get<ForecastReportResponse>(
      `/datasets/${datasetId}/forecast/laporan`,
      {
        signal,
        skipErrorToast: true,
      }
    );
    return response.data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr?.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

// F-29: Fallback memuat baris-baris prediksi tersimpan (GET /datasets/{id}/forecast)
// Dipanggil hanya bila GET /forecast/laporan mengembalikan `lengkap: false`.
export async function getSavedForecastRows(
  datasetId: number | string,
  signal?: AbortSignal
): Promise<ForecastSavedRowItem[]> {
  try {
    const response = await apiClient.get<ForecastSavedRowItem[]>(
      `/datasets/${datasetId}/forecast`,
      {
        signal,
        skipErrorToast: true,
      }
    );
    return response.data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr?.response?.status === 404) {
      return [];
    }
    throw err;
  }
}

// F-30: Mengunduh Buku Kerja Excel Resmi Multi-Sheet (GET /datasets/{id}/export/xlsx)
export async function downloadOfficialExcelReport(
  datasetId: number | string
): Promise<BlobDownloadResult> {
  const fallbackFilename = sanitizeDownloadFilename(
    `laporan_dataset_${datasetId}.xlsx`,
    'laporan_dataset.xlsx'
  );

  try {
    const response = await apiClient.get<Blob>(
      `/datasets/${datasetId}/export/xlsx`,
      {
        responseType: 'blob',
        timeout: FORECAST_AND_EXPORT_TIMEOUT_MS,
        skipErrorToast: true,
      }
    );

    const contentDisposition =
      (response.headers?.['content-disposition'] as string | undefined) || null;
    const filename = extractFilenameFromContentDisposition(
      contentDisposition,
      fallbackFilename
    );

    const blob = response.data;
    triggerBrowserBlobSave(blob, filename);

    return {
      filename,
      sizeBytes: blob.size,
    };
  } catch (err: unknown) {
    const msg = await extractBlobErrorMessage(
      err,
      'Gagal mengunduh berkas laporan Excel (.xlsx).'
    );
    throw new Error(msg);
  }
}

// F-31: Mengunduh Data Proyeksi Peramalan CSV utf-8-sig (GET /datasets/{id}/export/forecast.csv)
export async function downloadForecastCsvReport(
  datasetId: number | string
): Promise<BlobDownloadResult> {
  const fallbackFilename = sanitizeDownloadFilename(
    `forecast_dataset_${datasetId}.csv`,
    'forecast_dataset.csv'
  );

  try {
    const response = await apiClient.get<Blob>(
      `/datasets/${datasetId}/export/forecast.csv`,
      {
        responseType: 'blob',
        timeout: FORECAST_AND_EXPORT_TIMEOUT_MS,
        skipErrorToast: true,
      }
    );

    const contentDisposition =
      (response.headers?.['content-disposition'] as string | undefined) || null;
    const filename = extractFilenameFromContentDisposition(
      contentDisposition,
      fallbackFilename
    );

    const blob = response.data;
    triggerBrowserBlobSave(blob, filename);

    return {
      filename,
      sizeBytes: blob.size,
    };
  } catch (err: unknown) {
    const msg = await extractBlobErrorMessage(
      err,
      'Gagal mengunduh berkas CSV hasil peramalan.'
    );
    throw new Error(msg);
  }
}
