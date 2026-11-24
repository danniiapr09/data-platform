import { AggregationFunction } from './analytics';

/**
 * Definisi tipe data untuk Tab 4: Peramalan & Ekspor (Fase 6: F-26 s/d F-31)
 * sesuai kontrak kode backend FastAPI (`backend/app/api/forecast.py`,
 * `backend/app/forecasting/baseline.py`, dan `backend/app/api/export.py`).
 */

export type BaselineModelName =
  | 'naive'
  | 'moving_average'
  | 'drift'
  | 'linear_trend';

/** Payload body untuk POST /datasets/{id}/forecast (ForecastIn di forecast.py) */
export interface ForecastRequestPayload {
  nilai: string;
  waktu?: string | null;
  agg: AggregationFunction;
  horizon: number;
  test_size?: number | null;
}

/** Item evaluasi satu model baseline pada data uji holdout */
export interface ForecastEvaluationItem {
  model: BaselineModelName | string;
  mae: number | null;
  mape: number | null;
  rmse: number | null;
}

/** Titik perbandingan aktual vs prediksi model terbaik pada periode uji holdout */
export interface ForecastHoldoutPoint {
  periode: string | number;
  aktual: number | null;
  prediksi: number | null;
}

/** Titik proyeksi masa depan beserta batas bawah dan batas atas */
export interface ForecastPredictionPoint {
  periode: string | number;
  nilai: number | null;
  bawah: number | null;
  atas: number | null;
}

/** Respons dari POST /datasets/{id}/forecast */
export interface ForecastPostResponse {
  dataset_id: number;
  indikator: string;
  agg: AggregationFunction;
  kolom_waktu: string;
  jumlah_periode: number;
  periode_uji: number;
  model_terbaik: BaselineModelName | string;
  evaluasi: ForecastEvaluationItem[];
  perbandingan_uji: ForecastHoldoutPoint[];
  prediksi: ForecastPredictionPoint[];
  catatan: string[];
  // Field perluasan opsional di balik saklar B-13
  versi_bersih?: number | null;
}

/** Respons dari GET /datasets/{id}/forecast/laporan (F-28 & F-29) */
export interface ForecastReportResponse {
  dataset_id: number;
  indikator: string | null;
  agg: AggregationFunction | null;
  dibuat: string;
  lengkap: boolean;
  kolom_waktu?: string | null;
  horizon?: number;
  jumlah_periode?: number;
  periode_uji?: number;
  model_terbaik?: BaselineModelName | string;
  evaluasi?: ForecastEvaluationItem[];
  perbandingan_uji?: ForecastHoldoutPoint[];
  prediksi: ForecastPredictionPoint[];
  catatan?: string[];
  // Field perluasan opsional di balik saklar B-13
  versi_bersih?: number | null;
  is_forecast_stale?: boolean;
}

/** Item baris dari GET /datasets/{id}/forecast (fallback jika laporan.lengkap === false) */
export interface ForecastSavedRowItem {
  indikator: string | null;
  agg: AggregationFunction | null;
  periode: string;
  nilai_prediksi: number | null;
  batas_bawah: number | null;
  batas_atas: number | null;
  model: BaselineModelName | string;
  mae: number | null;
  mape: number | null;
  rmse: number | null;
  dibuat: string;
}

/** Hasil unduhan berkas blob beserta nama berkas yang telah dibersihkan */
export interface BlobDownloadResult {
  filename: string;
  sizeBytes: number;
}
