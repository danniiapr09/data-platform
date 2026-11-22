/**
 * Definisi tipe data untuk Dashboard Analitik & Galeri Diagram Adaptif (Fase 5: F-21 s/d F-25, F-34)
 * sesuai kontrak kode backend FastAPI (`backend/app/api/analysis.py`, `backend/app/api/compare.py`,
 * `backend/app/analysis/eda.py`, dan `backend/app/analysis/compare.py`).
 */

export type AggregationFunction = 'sum' | 'mean' | 'median' | 'min' | 'max';

export type SortOrder = 'asc' | 'desc';

/** Statistik 5 angka & deskriptif satu kolom numerik pada GET /datasets/{id}/eda */
export interface EdaNumericColumnSummary {
  jumlah: number;
  kosong: number;
  rata_rata: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  q1: number | null;
  q3: number | null;
  max: number | null;
}

/** Item nilai teratas satu kolom kategorikal pada GET /datasets/{id}/eda */
export interface EdaCategoricalTopValue {
  nilai: string;
  jumlah: number;
}

/** Ringkasan satu kolom kategorikal pada GET /datasets/{id}/eda */
export interface EdaCategoricalColumnSummary {
  unik: number;
  kosong: number;
  teratas: EdaCategoricalTopValue[];
}

/** Pasangan korelasi teratas pada GET /datasets/{id}/eda */
export interface EdaCorrelationPair {
  kolom_a: string;
  kolom_b: string;
  korelasi: number;
}

/** Respons dari GET /datasets/{id}/eda (F-21) */
export interface EdaOverviewResponse {
  dataset_id: number;
  jumlah_baris: number;
  kolom_waktu: string | null;
  kandidat_indikator: string[];
  ringkasan: {
    numerik: Record<string, EdaNumericColumnSummary>;
    kategorikal: Record<string, EdaCategoricalColumnSummary>;
  };
  korelasi: {
    matriks: Record<string, Record<string, number | null>>;
    pasangan_teratas: EdaCorrelationPair[];
  };
}

/** Satu bin pada GET /datasets/{id}/eda/distribution */
export interface EdaDistributionBin {
  dari: number | null;
  sampai: number | null;
  jumlah: number;
}

/** Respons dari GET /datasets/{id}/eda/distribution (F-22) */
export interface EdaDistributionResponse {
  kolom: string;
  skewness: number | null;
  bins: EdaDistributionBin[];
}

/** Satu titik periode deret waktu pada GET /datasets/{id}/eda/trend */
export interface EdaTrendPoint {
  periode: string | number;
  nilai: number | null;
  pertumbuhan_persen: number | null;
}

/** Deskripsi satu deret waktu (total atau satu kelompok) pada GET /datasets/{id}/eda/trend */
export interface EdaTrendSeries {
  titik: EdaTrendPoint[];
  slope_per_periode: number | null;
  arah: 'stabil' | 'naik' | 'turun' | 'data kurang';
}

/** Respons dari GET /datasets/{id}/eda/trend (F-23) */
export interface EdaTrendResponse {
  waktu: string;
  nilai: string;
  agg: AggregationFunction;
  total: EdaTrendSeries;
  per_kelompok: Record<string, EdaTrendSeries> | null;
}

/** Respons dari GET /datasets/{id}/compare/options (F-24 & F-34) */
export interface CompareOptionsResponse {
  kolom_waktu: string | null;
  kolom_angka: string[];
  kolom_kelompok: string[];
  periode: string[];
  pilihan_filter: Record<string, string[]>;
  agg: AggregationFunction[];
}

/** Item kelompok pada GET /datasets/{id}/compare */
export interface CompareCategoryItem {
  label: string | number;
  nilai: number | null;
  persen_dari_total: number | null;
}

/** Respons dari GET /datasets/{id}/compare (F-24 & F-34 Bar/Donut/Bubble) */
export interface CompareCategoryResponse {
  nilai: string;
  kelompok: string;
  agg: AggregationFunction;
  jumlah_kelompok: number;
  total: number | null;
  rata_rata_per_kelompok: number | null;
  grafik_disarankan: string[];
  data: CompareCategoryItem[];
  deskripsi: string;
}

/** Item perubahan periode pada GET /datasets/{id}/compare/periode */
export interface ComparePeriodeItem {
  label: string | number;
  periode_a: number | null;
  periode_b: number | null;
  selisih: number | null;
  persen: number | null;
}

/** Respons dari GET /datasets/{id}/compare/periode (F-24) */
export interface ComparePeriodeResponse {
  nilai: string;
  kelompok: string;
  agg: AggregationFunction;
  periode_a: string;
  periode_b: string;
  total_a: number | null;
  total_b: number | null;
  grafik_disarankan: string[];
  data: ComparePeriodeItem[];
  deskripsi: string;
}

/** Item rasio per kelompok pada GET /datasets/{id}/ratio */
export interface RatioCategoryItem {
  label: string | number;
  pembilang: number | null;
  penyebut: number | null;
  rasio: number | null;
  selisih_vs_keseluruhan: number | null;
}

/** Respons dari GET /datasets/{id}/ratio (F-25) */
export interface RatioResponse {
  pembilang: string;
  penyebut: string;
  kelompok: string;
  satuan: '%' | 'x';
  rasio_keseluruhan: number | null;
  rata_rata_rasio: number | null;
  grafik_disarankan: string[];
  data: RatioCategoryItem[];
  deskripsi: string;
}

/** Node hierarki untuk kontrak usulan B-07 (GET /datasets/{id}/analysis/hierarchy) */
export interface HierarchyNodeItem {
  name: string;
  value?: number;
  fill?: string;
  children?: HierarchyNodeItem[];
}

/** Respons kontrak usulan B-07: GET /datasets/{id}/analysis/hierarchy */
export interface HierarchyAnalysisResponse {
  dataset_id: number;
  levels: string[];
  nilai: string;
  agg: AggregationFunction;
  root: HierarchyNodeItem;
}

/** Respons kontrak usulan B-07: GET /datasets/{id}/analysis/matrix */
export interface Matrix2DAnalysisResponse {
  dataset_id: number;
  baris: string;
  kolom: string;
  nilai: string;
  agg: AggregationFunction;
  label_baris: string[];
  label_kolom: string[];
  nilai_matriks: Array<Array<number | null>>;
  min: number | null;
  max: number | null;
}

/** Jenis kolom untuk panel pemilih kolom reaktif (F-34) */
export type AnalyticsColumnKind = 'category' | 'numeric' | 'time';

export interface SelectableColumnInfo {
  name: string;
  kind: AnalyticsColumnKind;
  isLikelyIdentifier: boolean;
  uniqueCount?: number;
  missingCount?: number;
}
