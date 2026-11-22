import { apiClient } from './apiClient';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  AggregationFunction,
  CompareCategoryResponse,
  CompareOptionsResponse,
  ComparePeriodeResponse,
  EdaDistributionResponse,
  EdaOverviewResponse,
  EdaTrendResponse,
  HierarchyAnalysisResponse,
  Matrix2DAnalysisResponse,
  RatioResponse,
  SortOrder,
} from '@/types/analytics';

/**
 * Lapisan service untuk Dashboard Analitik & Galeri Diagram Adaptif (Fase 5).
 * Seluruh fungsi memakai `skipErrorToast: true` dan menerima `AbortSignal`
 * agar pembatalan request usang dan error per kartu ditangani secara lokal
 * tanpa memicu toast error ganda.
 */

// F-21: Ikhtisar Statistik 5 Angka, Profil Kategorikal & Matriks Korelasi (GET /datasets/{id}/eda)
export async function getEdaOverview(
  datasetId: number | string,
  signal?: AbortSignal
): Promise<EdaOverviewResponse> {
  const response = await apiClient.get<EdaOverviewResponse>(
    `/datasets/${datasetId}/eda`,
    {
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-22: Distribusi Nilai / Histogram Bins (GET /datasets/{id}/eda/distribution)
export async function getEdaDistribution(
  datasetId: number | string,
  params: {
    kolom: string;
    bins?: number;
  },
  signal?: AbortSignal
): Promise<EdaDistributionResponse> {
  const response = await apiClient.get<EdaDistributionResponse>(
    `/datasets/${datasetId}/eda/distribution`,
    {
      params: {
        kolom: params.kolom,
        bins: params.bins ?? 10,
      },
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-23: Tren Historis Deret Waktu (GET /datasets/{id}/eda/trend)
export async function getEdaTrend(
  datasetId: number | string,
  params: {
    nilai: string;
    waktu?: string | null;
    agg?: AggregationFunction;
    group_by?: string | null;
  },
  signal?: AbortSignal
): Promise<EdaTrendResponse> {
  const queryParams: Record<string, string> = {
    nilai: params.nilai,
    agg: params.agg ?? 'sum',
  };
  if (params.waktu) {
    queryParams.waktu = params.waktu;
  }
  if (params.group_by) {
    queryParams.group_by = params.group_by;
  }

  const response = await apiClient.get<EdaTrendResponse>(
    `/datasets/${datasetId}/eda/trend`,
    {
      params: queryParams,
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-24 & F-34: Opsi Kolom Analisis & Filter (GET /datasets/{id}/compare/options)
export async function getCompareOptions(
  datasetId: number | string,
  signal?: AbortSignal
): Promise<CompareOptionsResponse> {
  const response = await apiClient.get<CompareOptionsResponse>(
    `/datasets/${datasetId}/compare/options`,
    {
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-24 & F-34: Komparasi Antar-Kelompok Kategori (GET /datasets/{id}/compare)
export async function getCompareCategory(
  datasetId: number | string,
  params: {
    nilai: string;
    kelompok: string;
    agg?: AggregationFunction;
    waktu?: string | null;
    periode?: string | null;
    dari?: number | null;
    sampai?: number | null;
    filter_kolom?: string | null;
    filter_nilai?: string | null;
    urut?: SortOrder;
    top?: number | null;
  },
  signal?: AbortSignal
): Promise<CompareCategoryResponse> {
  const queryParams: Record<string, string | number> = {
    nilai: params.nilai,
    kelompok: params.kelompok,
    agg: params.agg ?? 'sum',
    urut: params.urut ?? 'desc',
  };
  if (params.waktu) queryParams.waktu = params.waktu;
  if (params.periode) queryParams.periode = params.periode;
  if (params.dari !== undefined && params.dari !== null) {
    queryParams.dari = params.dari;
  }
  if (params.sampai !== undefined && params.sampai !== null) {
    queryParams.sampai = params.sampai;
  }
  if (params.filter_kolom && params.filter_nilai) {
    queryParams.filter_kolom = params.filter_kolom;
    queryParams.filter_nilai = params.filter_nilai;
  }
  if (params.top !== undefined && params.top !== null) {
    queryParams.top = params.top;
  }

  const response = await apiClient.get<CompareCategoryResponse>(
    `/datasets/${datasetId}/compare`,
    {
      params: queryParams,
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-24: Komparasi Pertumbuhan Dua Periode Waktu A vs B (GET /datasets/{id}/compare/periode)
export async function getComparePeriode(
  datasetId: number | string,
  params: {
    nilai: string;
    kelompok: string;
    periode_a: string;
    periode_b: string;
    agg?: AggregationFunction;
    waktu?: string | null;
    filter_kolom?: string | null;
    filter_nilai?: string | null;
  },
  signal?: AbortSignal
): Promise<ComparePeriodeResponse> {
  const queryParams: Record<string, string> = {
    nilai: params.nilai,
    kelompok: params.kelompok,
    periode_a: params.periode_a,
    periode_b: params.periode_b,
    agg: params.agg ?? 'sum',
  };
  if (params.waktu) queryParams.waktu = params.waktu;
  if (params.filter_kolom && params.filter_nilai) {
    queryParams.filter_kolom = params.filter_kolom;
    queryParams.filter_nilai = params.filter_nilai;
  }

  const response = await apiClient.get<ComparePeriodeResponse>(
    `/datasets/${datasetId}/compare/periode`,
    {
      params: queryParams,
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// F-25: Kalkulator Rasio Indikator (GET /datasets/{id}/ratio)
export async function getRatioAnalysis(
  datasetId: number | string,
  params: {
    pembilang: string;
    penyebut: string;
    kelompok: string;
    sebagai_persen?: boolean;
    waktu?: string | null;
    periode?: string | null;
    dari?: number | null;
    sampai?: number | null;
    filter_kolom?: string | null;
    filter_nilai?: string | null;
    urut?: SortOrder;
    top?: number | null;
  },
  signal?: AbortSignal
): Promise<RatioResponse> {
  const queryParams: Record<string, string | number | boolean> = {
    pembilang: params.pembilang,
    penyebut: params.penyebut,
    kelompok: params.kelompok,
    sebagai_persen: Boolean(params.sebagai_persen),
    urut: params.urut ?? 'desc',
  };
  if (params.waktu) queryParams.waktu = params.waktu;
  if (params.periode) queryParams.periode = params.periode;
  if (params.dari !== undefined && params.dari !== null) {
    queryParams.dari = params.dari;
  }
  if (params.sampai !== undefined && params.sampai !== null) {
    queryParams.sampai = params.sampai;
  }
  if (params.filter_kolom && params.filter_nilai) {
    queryParams.filter_kolom = params.filter_kolom;
    queryParams.filter_nilai = params.filter_nilai;
  }
  if (params.top !== undefined && params.top !== null) {
    queryParams.top = params.top;
  }

  const response = await apiClient.get<RatioResponse>(
    `/datasets/${datasetId}/ratio`,
    {
      params: queryParams,
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// B-07: Endpoint Agregasi Hierarki (Circle Packing & Sunburst)
// TODO(B-07): Aktifkan saklar B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT ketika GET /datasets/{id}/analysis/hierarchy tersedia.
export async function getHierarchyAnalysis(
  datasetId: number | string,
  params: {
    levels: string[];
    nilai: string;
    agg?: AggregationFunction;
  },
  signal?: AbortSignal
): Promise<HierarchyAnalysisResponse | null> {
  if (!BACKEND_CAPABILITIES.B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT) {
    return null;
  }
  const response = await apiClient.get<HierarchyAnalysisResponse>(
    `/datasets/${datasetId}/analysis/hierarchy`,
    {
      params: {
        levels: params.levels.join(','),
        nilai: params.nilai,
        agg: params.agg ?? 'sum',
      },
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}

// B-07: Endpoint Agregasi Matriks 2D (Heatmap Kategori A × Kategori B)
// TODO(B-07): Aktifkan saklar B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT ketika GET /datasets/{id}/analysis/matrix tersedia.
export async function getMatrix2DAnalysis(
  datasetId: number | string,
  params: {
    baris: string;
    kolom: string;
    nilai: string;
    agg?: AggregationFunction;
  },
  signal?: AbortSignal
): Promise<Matrix2DAnalysisResponse | null> {
  if (!BACKEND_CAPABILITIES.B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT) {
    return null;
  }
  const response = await apiClient.get<Matrix2DAnalysisResponse>(
    `/datasets/${datasetId}/analysis/matrix`,
    {
      params: {
        baris: params.baris,
        kolom: params.kolom,
        nilai: params.nilai,
        agg: params.agg ?? 'sum',
      },
      signal,
      skipErrorToast: true,
    }
  );
  return response.data;
}
