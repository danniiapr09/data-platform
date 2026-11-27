import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { WorkspaceOutletContext } from '@/layouts/WorkspaceLayout';
import { useWorkspaceTabState } from '@/context/WorkspaceTabStateContext';
import { Button } from '@/components/common/Button';
import { showToast } from '@/components/common/Toast';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  AGGREGATION_LABELS,
  isLikelyIdentifierColumn,
} from '@/components/analytics/ColumnSelectorSidebar';
import { ForecastConfigForm } from '@/components/forecast/ForecastConfigForm';
import {
  ForecastTimeSeriesChartCard,
  MODEL_SHORT_LABELS,
} from '@/components/forecast/ForecastTimeSeriesChartCard';
import { ModelLeaderboardCard } from '@/components/forecast/ModelLeaderboardCard';
import { OfficialExportCenterCard } from '@/components/forecast/OfficialExportCenterCard';
import { getEdaOverview, getEdaTrend } from '@/services/analyticsService';
import { getDatasetHistory } from '@/services/datasetService';
import {
  getSavedForecastReport,
  getSavedForecastRows,
  runDatasetForecast,
} from '@/services/forecastService';
import { AggregationFunction } from '@/types/analytics';
import { HistoryLogItem } from '@/types/dataset';
import {
  ForecastEvaluationItem,
  ForecastPredictionPoint,
} from '@/types/forecast';
import { formatDateTimeId, formatNumberId } from '@/utils/formatters';

/**
 * Penanda Peramalan Usang Berbasis Riwayat Pemrosesan (`GET /datasets/{id}/history`)
 * Sesuai Penyesuaian Wajib butir a:
 * - Di `backend/app/api/reports.py` baris 71–80, `GET /history` memuat seluruh baris `ProcessingLog`
 *   kecuali `("cleaning_report", "forecast_report")` yang diurutkan menurut `ProcessingLog.id` menaik
 *   tanpa limit/paginasi.
 * - Setiap proses pembersihan mencatat `langkah="cleaning"`, edit sel mencatat `langkah="edit_data"`,
 *   terapkan review mencatat `langkah="apply_review"`, dan peramalan mencatat `langkah="forecasting"`.
 * - Peramalan dianggap USANG apabila terdapat langkah `cleaning`, `edit_data`, atau `apply_review`
 *   pada posisi indeks SETELAH posisi indeks `forecasting` terakhir di dalam daftar riwayat.
 */
interface StaleForecastDetectionResult {
  isStale: boolean;
  reasonSummary: string | null;
  stepsAfterForecast: HistoryLogItem[];
}

function detectStaleForecastFromHistory(
  historyLogs: HistoryLogItem[],
  hasSavedForecast: boolean,
  currentCleanVersion: number | null,
  reportCleanVersion?: number | null,
  reportExplicitStale?: boolean
): StaleForecastDetectionResult {
  if (!hasSavedForecast) {
    return { isStale: false, reasonSummary: null, stepsAfterForecast: [] };
  }

  // 1. Jika saklar B13_FORECAST_DATA_VERSION diaktifkan dan backend mengirim versi_bersih pada laporan
  if (BACKEND_CAPABILITIES.B13_FORECAST_DATA_VERSION) {
    if (reportExplicitStale === true) {
      return {
        isStale: true,
        reasonSummary:
          'Data bersih telah dimodifikasi setelah peramalan terakhir dihitung.',
        stepsAfterForecast: [],
      };
    }
    if (
      reportCleanVersion !== undefined &&
      reportCleanVersion !== null &&
      currentCleanVersion !== null &&
      reportCleanVersion !== currentCleanVersion
    ) {
      return {
        isStale: true,
        reasonSummary: `Peramalan dihitung pada data bersih v${reportCleanVersion}, sedangkan data bersih saat ini sudah berada pada v${currentCleanVersion}.`,
        stepsAfterForecast: [],
      };
    }
  }

  // 2. Deteksi deterministik dari urutan posisi di dalam daftar GET /datasets/{id}/history
  if (!historyLogs || historyLogs.length === 0) {
    return { isStale: false, reasonSummary: null, stepsAfterForecast: [] };
  }

  let lastForecastIdx = -1;
  for (let i = historyLogs.length - 1; i >= 0; i--) {
    if (historyLogs[i].langkah === 'forecasting') {
      lastForecastIdx = i;
      break;
    }
  }

  if (lastForecastIdx === -1) {
    return { isStale: false, reasonSummary: null, stepsAfterForecast: [] };
  }

  const mutatingStepTypes = new Set(['cleaning', 'edit_data', 'apply_review']);
  const stepsAfter: HistoryLogItem[] = [];

  for (let i = lastForecastIdx + 1; i < historyLogs.length; i++) {
    if (mutatingStepTypes.has(historyLogs[i].langkah)) {
      stepsAfter.push(historyLogs[i]);
    }
  }

  if (stepsAfter.length === 0) {
    return { isStale: false, reasonSummary: null, stepsAfterForecast: [] };
  }

  const uniqueKinds = new Set(stepsAfter.map((s) => s.langkah));
  const actionLabels: string[] = [];
  if (uniqueKinds.has('edit_data')) {
    actionLabels.push('koreksi/edit nilai sel');
  }
  if (uniqueKinds.has('apply_review')) {
    actionLabels.push('penerapan review anomali (pembuangan baris ditolak)');
  }
  if (uniqueKinds.has('cleaning')) {
    actionLabels.push('pembersihan ulang data');
  }

  const lastMutatingStep = stepsAfter[stepsAfter.length - 1];
  const reasonSummary = `Data diubah setelah peramalan dihitung melalui ${actionLabels.join(
    ', '
  )} (${stepsAfter.length} langkah perubahan; terakhir: "${
    lastMutatingStep.ringkasan
  }").`;

  return {
    isStale: true,
    reasonSummary,
    stepsAfterForecast: stepsAfter,
  };
}

/**
 * Tab 4: Peramalan & Ekspor (Fase 6: F-26 s/d F-31)
 */
export const ForecastingTab: React.FC = () => {
  const { datasetId: routeDatasetId = '' } = useParams<{ datasetId: string }>();
  const {
    dataset,
    isLoading: isDatasetLoading,
    refetchDataset,
  } = useOutletContext<WorkspaceOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const datasetId = String(dataset?.id || routeDatasetId);
  const cleanVersion = dataset?.versi_bersih ?? null;
  const hasCleanVersion =
    dataset !== undefined &&
    cleanVersion !== null &&
    cleanVersion !== undefined;

  // 1. Query Ikhtisar EDA (GET /datasets/{id}/eda) untuk mendapatkan kandidat_indikator & kolom_waktu
  // HANYA dipanggil jika dataset sudah dibersihkan (hasCleanVersion === true)
  const {
    data: edaOverview,
    isLoading: isEdaLoading,
    error: edaError,
    refetch: refetchEda,
  } = useQuery({
    queryKey: ['dataset-eda', datasetId, cleanVersion],
    queryFn: ({ signal }) => getEdaOverview(datasetId, signal),
    enabled: Boolean(datasetId) && hasCleanVersion,
    placeholderData: keepPreviousData,
  });

  // 2. Query Hasil Peramalan Tersimpan (GET /datasets/{id}/forecast/laporan) — F-29 (Tanpa POST)
  const {
    data: forecastReport,
    isLoading: isReportLoading,
    isFetching: isReportFetching,
    error: reportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['dataset-forecast-report', datasetId],
    queryFn: ({ signal }) => getSavedForecastReport(datasetId, signal),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  const hasSavedForecast =
    forecastReport !== null &&
    forecastReport !== undefined &&
    Array.isArray(forecastReport.prediksi) &&
    forecastReport.prediksi.length > 0;

  // 2b. Fallback Query GET /datasets/{id}/forecast HANYA jika laporan.lengkap === false
  const isLegacyIncomplete =
    hasSavedForecast && forecastReport?.lengkap === false;

  const { data: legacyForecastRows = [] } = useQuery({
    queryKey: ['dataset-forecast-rows', datasetId],
    queryFn: ({ signal }) => getSavedForecastRows(datasetId, signal),
    enabled: Boolean(datasetId) && hasCleanVersion && isLegacyIncomplete,
  });

  // 3. Query Riwayat Pemrosesan (GET /datasets/{id}/history) untuk Deteksi Peramalan Usang (Penyesuaian Wajib butir a)
  const { data: historyLogs = [] } = useQuery({
    queryKey: ['dataset-history', datasetId],
    queryFn: () => getDatasetHistory(datasetId),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  const { state: tabMemory, updateTab4 } = useWorkspaceTabState();

  // State Form Konfigurasi (dipertahankan di memori React saat berpindah antar-tab)
  const [selectedIndicator, setSelectedIndicator] = useState<string>(
    () => tabMemory.tab4.selectedIndicator ?? ''
  );
  const [selectedTimeColumn, setSelectedTimeColumn] = useState<string>(
    () => tabMemory.tab4.selectedTimeColumn ?? ''
  );
  const [selectedAggregation, setSelectedAggregation] =
    useState<AggregationFunction>(
      () => tabMemory.tab4.selectedAggregation ?? 'sum'
    );
  const [horizon, setHorizon] = useState<number>(
    () => tabMemory.tab4.horizon ?? 3
  );
  const [testSizeInput, setTestSizeInput] = useState<string>(
    () => tabMemory.tab4.testSizeInput ?? ''
  );

  useEffect(() => {
    if (!selectedIndicator && !selectedTimeColumn && !testSizeInput && horizon === 3) {
      return;
    }
    updateTab4({
      selectedIndicator,
      selectedTimeColumn,
      selectedAggregation,
      horizon,
      testSizeInput,
      hasCustomEdits: true,
    });
  }, [
    selectedIndicator,
    selectedTimeColumn,
    selectedAggregation,
    horizon,
    testSizeInput,
    updateTab4,
  ]);

  // State Error 400 / Jaringan di Dalam Kartu Form & Penyesuaian Periode Uji Efektif
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [effectiveTestSizeNotice, setEffectiveTestSizeNotice] = useState<{
    requested: number;
    effective: number;
    totalPeriods: number;
  } | null>(null);

  // Pelacak apakah form sudah diinisialisasi pada muat awal tab untuk datasetId saat ini
  // (Jawaban Pertanyaan Terbuka #1: hanya sinkron saat muat awal tab dibuka dan setelah penghitungan berhasil,
  // jangan menimpa pilihan yang sedang diubah pengguna saat data disegarkan di latar)
  const initializedDatasetIdRef = useRef<string | null>(null);

  // Daftar seluruh kolom dataset (numerik + kategorikal) untuk pemilih waktu manual bila kolom_waktu null
  const allDatasetColumns = useMemo(() => {
    if (!edaOverview) return [];
    const set = new Set<string>();
    if (edaOverview.kolom_waktu) set.add(edaOverview.kolom_waktu);
    for (const c of Object.keys(edaOverview.ringkasan?.kategorikal || {})) {
      set.add(c);
    }
    for (const c of Object.keys(edaOverview.ringkasan?.numerik || {})) {
      set.add(c);
    }
    return Array.from(set);
  }, [edaOverview]);

  const candidateIndicators = useMemo(
    () => edaOverview?.kandidat_indikator || [],
    [edaOverview]
  );

  // Reset pelacak inisialisasi bila pengguna berpindah ke datasetId lain
  useEffect(() => {
    if (
      initializedDatasetIdRef.current !== null &&
      initializedDatasetIdRef.current !== datasetId
    ) {
      initializedDatasetIdRef.current = null;
      setFormSubmitError(null);
      setEffectiveTestSizeNotice(null);
    }
  }, [datasetId]);

  // Inisialisasi nilai form HANYA saat tab pertama kali selesai memuat data awal (edaOverview + forecastReport)
  useEffect(() => {
    if (
      !hasCleanVersion ||
      isEdaLoading ||
      isReportLoading ||
      !edaOverview ||
      initializedDatasetIdRef.current === datasetId
    ) {
      return;
    }

    if (tabMemory.tab4.hasCustomEdits) {
      initializedDatasetIdRef.current = datasetId;
      return;
    }

    const detectedTime = edaOverview.kolom_waktu || '';
    const nonIdCandidates = candidateIndicators.filter(
      (c) => !isLikelyIdentifierColumn(c)
    );
    const defaultIndicator =
      nonIdCandidates[0] || candidateIndicators[0] || '';

    if (forecastReport && forecastReport.prediksi?.length > 0) {
      const savedInd =
        forecastReport.indikator &&
        candidateIndicators.includes(forecastReport.indikator)
          ? forecastReport.indikator
          : forecastReport.indikator || defaultIndicator;
      const savedTime = forecastReport.kolom_waktu || detectedTime;
      const savedAgg = (forecastReport.agg as AggregationFunction) || 'sum';
      const savedHor =
        forecastReport.horizon ?? forecastReport.prediksi.length ?? 3;

      setSelectedIndicator(savedInd);
      setSelectedTimeColumn(savedTime);
      setSelectedAggregation(savedAgg);
      setHorizon(Math.max(1, Math.min(24, savedHor)));
      setTestSizeInput(
        forecastReport.periode_uji !== undefined &&
          forecastReport.periode_uji !== null
          ? String(forecastReport.periode_uji)
          : ''
      );
    } else {
      setSelectedIndicator(defaultIndicator);
      setSelectedTimeColumn(detectedTime);
      setSelectedAggregation('sum');
      setHorizon(3);
      setTestSizeInput('');
    }

    initializedDatasetIdRef.current = datasetId;
  }, [
    hasCleanVersion,
    isEdaLoading,
    isReportLoading,
    edaOverview,
    forecastReport,
    candidateIndicators,
    datasetId,
  ]);

  // Parameter Hasil Tersimpan yang Dipakai oleh Grafik & Tabel (Penyesuaian Wajib butir b:
  // Grafik memakai parameter dari LAPORAN tersimpan, BUKAN dari nilai form yang sedang diubah pengguna)
  const savedReportParams = useMemo(() => {
    if (!hasSavedForecast || !forecastReport) return null;

    const firstLegacyRow = legacyForecastRows[0];
    const indicator =
      forecastReport.indikator ||
      firstLegacyRow?.indikator ||
      candidateIndicators[0] ||
      '';
    const timeCol =
      forecastReport.kolom_waktu || edaOverview?.kolom_waktu || null;
    const agg: AggregationFunction =
      (forecastReport.agg as AggregationFunction) ||
      (firstLegacyRow?.agg as AggregationFunction) ||
      'sum';
    const savedHorizon =
      forecastReport.horizon ?? forecastReport.prediksi.length ?? 3;
    const bestModel =
      forecastReport.model_terbaik || firstLegacyRow?.model || 'linear_trend';

    let evaluations: ForecastEvaluationItem[] =
      forecastReport.evaluasi && forecastReport.evaluasi.length > 0
        ? forecastReport.evaluasi
        : [];

    if (evaluations.length === 0 && firstLegacyRow) {
      evaluations = [
        {
          model: firstLegacyRow.model,
          mae: firstLegacyRow.mae,
          mape: firstLegacyRow.mape,
          rmse: firstLegacyRow.rmse,
        },
      ];
    }

    const holdoutPoints = forecastReport.perbandingan_uji || [];
    const predictionPoints: ForecastPredictionPoint[] =
      forecastReport.prediksi || [];
    const notes = forecastReport.catatan || [];

    return {
      indicator,
      timeCol,
      agg,
      savedHorizon,
      bestModel,
      evaluations,
      holdoutPoints,
      predictionPoints,
      notes,
      totalPeriods: forecastReport.jumlah_periode,
      testPeriodsCount: forecastReport.periode_uji,
      calculatedAtIso: forecastReport.dibuat || firstLegacyRow?.dibuat || null,
    };
  }, [
    hasSavedForecast,
    forecastReport,
    legacyForecastRows,
    candidateIndicators,
    edaOverview?.kolom_waktu,
  ]);

  // 4. Query Deret Waktu Historis (/eda/trend) MEMAKAI PARAMETER HASIL TERSIMPAN (Penyesuaian Wajib butir b)
  const {
    data: savedHistoricalTrend,
    isLoading: isHistoricalLoading,
    isFetching: isHistoricalFetching,
    error: historicalError,
    refetch: refetchHistorical,
  } = useQuery({
    queryKey: [
      'dataset-forecast-trend',
      datasetId,
      cleanVersion,
      savedReportParams?.indicator,
      savedReportParams?.timeCol,
      savedReportParams?.agg,
    ],
    queryFn: ({ signal }) =>
      getEdaTrend(
        datasetId,
        {
          nilai: savedReportParams!.indicator,
          waktu: savedReportParams!.timeCol,
          agg: savedReportParams!.agg,
        },
        signal
      ),
    enabled:
      Boolean(datasetId) &&
      hasCleanVersion &&
      Boolean(savedReportParams?.indicator) &&
      Boolean(savedReportParams?.timeCol),
  });

  const historicalErrorMessage = historicalError
    ? (historicalError as Error & { localizedMessage?: string })
        ?.localizedMessage ||
      'Gagal memuat data historis untuk grafik peramalan.'
    : !savedReportParams?.timeCol && hasSavedForecast
    ? 'Kolom sumbu waktu tidak tercatat pada laporan lama dan tidak terdeteksi otomatis.'
    : null;

  // Evaluasi Deteksi Peramalan Usang Berbasis Riwayat (Penyesuaian Wajib butir a)
  const staleDetection = useMemo(
    () =>
      detectStaleForecastFromHistory(
        historyLogs,
        hasSavedForecast,
        cleanVersion,
        forecastReport?.versi_bersih,
        forecastReport?.is_forecast_stale
      ),
    [
      historyLogs,
      hasSavedForecast,
      cleanVersion,
      forecastReport?.versi_bersih,
      forecastReport?.is_forecast_stale,
    ]
  );

  // Mutasi POST /datasets/{id}/forecast (F-26)
  const forecastMutation = useMutation({
    mutationFn: async (params: {
      nilai: string;
      waktu: string;
      agg: AggregationFunction;
      horizon: number;
      requestedTestSize: number | null;
    }) => {
      const res = await runDatasetForecast(datasetId, {
        nilai: params.nilai,
        waktu: params.waktu,
        agg: params.agg,
        horizon: params.horizon,
        test_size: params.requestedTestSize,
      });
      return { res, requestedTestSize: params.requestedTestSize };
    },
    onSuccess: async ({ res, requestedTestSize }) => {
      setFormSubmitError(null);

      // Penyesuaian Wajib butir c: Tampilkan periode uji efektif ("diminta M, dipakai N") bila berbeda dari yang diisi
      if (
        requestedTestSize !== null &&
        res.periode_uji !== undefined &&
        res.periode_uji !== requestedTestSize
      ) {
        setEffectiveTestSizeNotice({
          requested: requestedTestSize,
          effective: res.periode_uji,
          totalPeriods: res.jumlah_periode,
        });
      } else {
        setEffectiveTestSizeNotice(null);
      }

      // Sinkronkan form dengan hasil perhitungan yang baru berhasil (Jawaban Pertanyaan Terbuka #1)
      setSelectedIndicator(res.indikator);
      setSelectedTimeColumn(res.kolom_waktu);
      setSelectedAggregation(res.agg);
      setHorizon(res.prediksi.length);
      setTestSizeInput(String(res.periode_uji));

      // Invalidate hasil peramalan, riwayat pemrosesan (agar banner usang hilang), dan detail dataset
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['dataset-forecast-report', datasetId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dataset-forecast-rows', datasetId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dataset-forecast-trend', datasetId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dataset-history', datasetId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['dataset-detail', datasetId],
        }),
        queryClient.invalidateQueries({ queryKey: ['datasets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);

      const modelLabel =
        MODEL_SHORT_LABELS[res.model_terbaik] || res.model_terbaik;
      showToast(
        `Peramalan berhasil dihitung (${res.indikator}, horizon ${formatNumberId(
          res.prediksi.length,
          0
        )} periode, model terbaik: ${modelLabel}).`,
        'success'
      );
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        code?: string;
        localizedMessage?: string;
        response?: { status?: number; data?: { detail?: unknown } };
      };
      const detail = axiosErr?.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim() !== '') {
        setFormSubmitError(detail.trim());
        return;
      }
      if (axiosErr?.code === 'ECONNABORTED') {
        setFormSubmitError(
          'Waktu tunggu perhitungan habis (timeout 60 detik). Silakan periksa koneksi atau kurangi horizon.'
        );
        return;
      }
      setFormSubmitError(
        axiosErr?.localizedMessage ||
          'Gagal menghitung peramalan deret waktu. Pastikan server backend aktif dan parameter valid.'
      );
    },
  });

  // Handler Tunggal untuk Menghitung / Menghitung Ulang Peramalan (dipakai oleh tombol Form & tombol Banner Usang)
  const handleRunForecast = () => {
    if (forecastMutation.isPending) return;
    setFormSubmitError(null);

    if (!selectedIndicator) {
      setFormSubmitError('Silakan pilih kolom Indikator Target terlebih dahulu.');
      return;
    }
    if (!selectedTimeColumn) {
      setFormSubmitError('Silakan pilih kolom Sumbu Waktu terlebih dahulu.');
      return;
    }
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 24) {
      setFormSubmitError(
        'Horizon prediksi harus berupa bilangan bulat antara 1 sampai 24 periode.'
      );
      return;
    }

    let requestedTestSize: number | null = null;
    if (testSizeInput.trim() !== '') {
      const parsed = Number(testSizeInput.trim());
      if (!Number.isInteger(parsed) || parsed < 1) {
        setFormSubmitError(
          'Ukuran Data Uji (test_size) harus berupa bilangan bulat minimal 1 periode.'
        );
        return;
      }
      requestedTestSize = parsed;
    }

    forecastMutation.mutate({
      nilai: selectedIndicator,
      waktu: selectedTimeColumn,
      agg: selectedAggregation,
      horizon,
      requestedTestSize,
    });
  };

  // 1. Kondisi Loading Metadata Dataset
  if (isDatasetLoading) {
    return (
      <div className="p-12 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
        Memuat status dataset untuk Tab Peramalan & Ekspor...
      </div>
    );
  }

  // 2. Kondisi Dataset Belum Dibersihkan (Aturan Konten: Tampilkan kondisi kosong dengan tombol menuju Tab 2, jangan memanggil endpoint peramalan)
  if (!hasCleanVersion) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto text-brand-primary-light dark:text-brand-primary-dark">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            Dataset Belum Melalui Proses Pembersihan
          </h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-lg mx-auto">
            Pemodelan peramalan deret waktu dan ekspor laporan buku kerja Excel
            hanya bekerja pada versi data bersih. Silakan jalankan pembersihan
            otomatis terlebih dahulu pada Tab 2.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={() => navigate(`/workspace/${datasetId}/review-anomali`)}
          >
            Buka Tab 2: Review Anomali & Editor
          </Button>
        </div>
      </div>
    );
  }

  const edaErrorMessage = edaError
    ? (edaError as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal memuat daftar kolom numerik dan waktu dari server backend.'
    : null;

  const reportErrorMessage = reportError
    ? (reportError as Error & { localizedMessage?: string })
        ?.localizedMessage ||
      'Gagal memeriksa laporan hasil peramalan tersimpan dari server backend.'
    : null;

  const firstPredPeriod =
    savedReportParams?.predictionPoints?.[0]?.periode ?? null;
  const lastPredPeriod =
    savedReportParams?.predictionPoints?.[
      savedReportParams.predictionPoints.length - 1
    ]?.periode ?? null;

  return (
    <div className="space-y-6 max-w-[1840px] mx-auto">
      {/* Baris Status Atas Tab 4: Status Data Terkini & Ringkasan Model Aktif (Tanpa Tombol Kedua "Jalankan Ulang Prediksi" dan Tanpa Klaim 95%) */}
      <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {BACKEND_CAPABILITIES.B02_LIVE_SYNC_CHANNEL
                ? `Live Sync • Data Bersih v${cleanVersion}`
                : `Data terkini • Versi Bersih v${cleanVersion}`}
            </span>
          </span>

          <span className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
            Total Baris Bersih:{' '}
            <strong className="text-text-primary-light dark:text-text-primary-dark">
              {formatNumberId(
                edaOverview?.jumlah_baris ?? dataset?.baris_bersih,
                0
              )}
            </strong>
          </span>

          {hasSavedForecast && savedReportParams && (
            <>
              <span className="text-border-light dark:text-border-dark">|</span>
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Model Terbaik Tersimpan:{' '}
                <strong className="font-mono text-text-primary-light dark:text-text-primary-dark">
                  {MODEL_SHORT_LABELS[savedReportParams.bestModel] ||
                    savedReportParams.bestModel}
                </strong>
              </span>
              <span className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                • Horizon:{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(savedReportParams.savedHorizon, 0)} periode
                  {firstPredPeriod !== null && lastPredPeriod !== null
                    ? ` (${firstPredPeriod}–${lastPredPeriod})`
                    : ''}
                </strong>
              </span>
            </>
          )}
        </div>

        {/* Waktu Perhitungan Tersimpan (F-29) */}
        {hasSavedForecast && savedReportParams?.calculatedAtIso && (
          <div className="inline-flex items-center gap-1.5 text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
            <Clock className="w-3.5 h-3.5 text-brand-primary-light dark:text-brand-primary-dark" />
            <span>
              Dihitung: {formatDateTimeId(savedReportParams.calculatedAtIso)}
            </span>
          </div>
        )}
      </div>

      {/* Banner Amber Peramalan Usang Berbasis Riwayat (Penyesuaian Wajib butir a) */}
      {staleDetection.isStale && (
        <div
          role="alert"
          className="p-4 rounded-card bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light/40 dark:border-anomaly-warning-text-dark/50 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <AlertTriangle className="w-5 h-5 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-bold text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                Hasil Peramalan Usang — Data Diubah Setelah Peramalan Dihitung
              </p>
              <p className="text-xs text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                {staleDetection.reasonSummary}
              </p>
              <p className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                Parameter hitung ulang saat ini: Indikator{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {selectedIndicator || '-'}
                </strong>{' '}
                • Sumbu Waktu{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {selectedTimeColumn || '-'}
                </strong>{' '}
                • Agregasi{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {AGGREGATION_LABELS[selectedAggregation]}
                </strong>{' '}
                • Horizon{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(horizon, 0)} periode
                </strong>
                {testSizeInput.trim() !== ''
                  ? ` • Data Uji ${testSizeInput.trim()} periode`
                  : ' • Data Uji Otomatis'}
              </p>
            </div>
          </div>

          {/* Tombol di Banner Memicu Handler Hitung yang SAMA dengan Tombol di Form */}
          <Button
            variant="primary"
            disabled={forecastMutation.isPending}
            icon={
              forecastMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )
            }
            onClick={handleRunForecast}
          >
            {forecastMutation.isPending
              ? 'Menghitung Peramalan...'
              : 'Hitung Ulang Peramalan'}
          </Button>
        </div>
      )}

      {/* Penanganan Error Tingkat Awal jika GET /eda atau GET /forecast/laporan Gagal */}
      {(edaErrorMessage || reportErrorMessage) && !edaOverview ? (
        <div className="p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                Tidak Dapat Memuat Data Konfigurasi Peramalan
              </h2>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                {edaErrorMessage || reportErrorMessage}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              refetchEda();
              refetchReport();
              refetchDataset();
            }}
          >
            Coba Lagi
          </Button>
        </div>
      ) : (
        <>
          {/* 1. Form Konfigurasi Parameter Peramalan Deret Waktu (F-26) */}
          <ForecastConfigForm
            candidateIndicators={candidateIndicators}
            detectedTimeColumn={edaOverview?.kolom_waktu ?? null}
            allColumns={allDatasetColumns}
            selectedIndicator={selectedIndicator}
            onIndicatorChange={setSelectedIndicator}
            selectedTimeColumn={selectedTimeColumn}
            onTimeColumnChange={setSelectedTimeColumn}
            selectedAggregation={selectedAggregation}
            onAggregationChange={setSelectedAggregation}
            horizon={horizon}
            onHorizonChange={setHorizon}
            testSizeInput={testSizeInput}
            onTestSizeInputChange={setTestSizeInput}
            hasSavedForecast={hasSavedForecast}
            isSubmitting={forecastMutation.isPending}
            errorMessage={formSubmitError}
            effectiveTestSizeNotice={effectiveTestSizeNotice}
            onSubmit={handleRunForecast}
          />

          {/* 2. Area Hasil Peramalan (Grafik F-27) atau Kondisi Kosong Sebelum Ada Hasil (F-29) */}
          {isReportLoading || (isReportFetching && !forecastReport) ? (
            <div
              className="p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-4 animate-pulse"
              aria-busy="true"
            >
              <div className="h-6 w-1/3 rounded bg-header-light dark:bg-header-dark" />
              <div className="h-72 w-full rounded-button bg-header-light dark:bg-header-dark" />
            </div>
          ) : hasSavedForecast && savedReportParams ? (
            <ForecastTimeSeriesChartCard
              datasetName={dataset?.nama}
              savedIndicator={savedReportParams.indicator}
              savedTimeColumn={savedReportParams.timeCol}
              savedAggregation={savedReportParams.agg}
              savedHorizon={savedReportParams.savedHorizon}
              calculatedAtIso={savedReportParams.calculatedAtIso}
              bestModelName={savedReportParams.bestModel}
              totalPeriods={savedReportParams.totalPeriods}
              testPeriodsCount={savedReportParams.testPeriodsCount}
              evaluations={savedReportParams.evaluations}
              historicalPoints={savedHistoricalTrend?.total?.titik || []}
              isHistoricalLoading={isHistoricalLoading}
              isHistoricalFetching={isHistoricalFetching}
              historicalErrorMessage={historicalErrorMessage}
              onRetryHistorical={() => refetchHistorical()}
              holdoutPoints={savedReportParams.holdoutPoints}
              predictionPoints={savedReportParams.predictionPoints}
              methodologicalNotes={savedReportParams.notes}
            />
          ) : (
            /* Kondisi Kosong yang Jelas bila Belum Ada Hasil Peramalan Tersimpan (F-29) */
            <div className="p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto text-brand-primary-light dark:text-brand-primary-dark">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                  Belum Ada Hasil Peramalan Tersimpan untuk Dataset Ini
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-xl mx-auto">
                  Tentukan parameter indikator target, kolom waktu, agregasi,
                  dan horizon prediksi pada kartu konfigurasi di atas, lalu klik{' '}
                  <strong>Hitung Peramalan</strong> untuk mengevaluasi 4 model
                  baseline dan memvisualisasikan proyeksi deret waktu.
                </p>
              </div>
            </div>
          )}

          {/* 3. Grid Bawah: Papan Peringkat Model Baseline (F-28) & Pusat Unduh Resmi (F-30, F-31) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Kiri (7 kolom): Tabel Papan Peringkat 4 Model Baseline atau Kondisi Kosong */}
            <div className="xl:col-span-7">
              {hasSavedForecast && savedReportParams ? (
                <ModelLeaderboardCard
                  bestModelName={savedReportParams.bestModel}
                  evaluations={savedReportParams.evaluations}
                  methodologicalNotes={savedReportParams.notes}
                  totalPeriods={savedReportParams.totalPeriods}
                  testPeriodsCount={savedReportParams.testPeriodsCount}
                  isLegacyIncompleteReport={isLegacyIncomplete}
                />
              ) : (
                <section
                  aria-label="Papan Peringkat Model Baseline Belum Tersedia"
                  className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-6 text-center space-y-2"
                >
                  <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                    Papan Peringkat & Evaluasi Model Baseline
                  </h3>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
                    Tabel perbandingan metrik MAE, MAPE (%), dan RMSE untuk 4
                    algoritma baseline (<code>linear_trend</code>,{' '}
                    <code>drift</code>, <code>moving_average</code>,{' '}
                    <code>naive</code>) beserta catatan metodologis akan
                    ditampilkan di sini setelah peramalan dihitung.
                  </p>
                </section>
              )}
            </div>

            {/* Kanan (5 kolom): Pusat Unduh & Ekspor Resmi (Selalu Tampil agar Excel Bisa Diunduh Walau Belum Forecast) */}
            <div className="xl:col-span-5">
              <OfficialExportCenterCard
                datasetId={datasetId}
                hasCleanData={hasCleanVersion}
                hasSavedForecast={hasSavedForecast}
                manualEditCount={dataset?.jumlah_edit_manual ?? 0}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ForecastingTab;
