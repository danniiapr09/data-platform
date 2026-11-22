import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  EyeOff,
  Info,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { WorkspaceOutletContext } from '@/layouts/WorkspaceLayout';
import { Button } from '@/components/common/Button';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  ColumnSelectorSidebar,
  isLikelyIdentifierColumn,
} from '@/components/analytics/ColumnSelectorSidebar';
import { EdaDescriptiveHistRatioSection } from '@/components/analytics/EdaDescriptiveHistRatioSection';
import { CorrelationMatrixCard } from '@/components/analytics/CorrelationMatrixCard';
import { PeriodComparisonCard } from '@/components/analytics/PeriodComparisonCard';
import {
  B07GalleryCardsSection,
  CategoryBarAndDonutCards,
  GroupBubbleScatterCard,
  TrendLineAndTimeHeatmapCards,
} from '@/components/analytics/AdaptiveGalleryCards';
import {
  getCompareOptions,
  getEdaOverview,
} from '@/services/analyticsService';
import {
  AggregationFunction,
  SelectableColumnInfo,
} from '@/types/analytics';
import { formatNumberId } from '@/utils/formatters';

/**
 * Tab 3: Dashboard Analitik & Galeri Diagram Adaptif (Fase 5: F-21 s/d F-25, F-34)
 *
 * Mematuhi seluruh Aturan Konten & Penyesuaian Wajib:
 * - Jika dataset belum dibersihkan (`versi_bersih === null`), tampilkan kondisi kosong dengan
 *   tombol menuju Tab 2 tanpa memanggil endpoint analisis apa pun.
 * - Menyertakan `versi_bersih` di dalam `queryKey` React Query.
 * - Banner catatan perubahan versi hanya tampil bila `versi_bersih` berubah selama Tab 3 terbuka
 *   (atau setelah sesi dibuka), dengan teks netral "Data bersih diperbarui ke v{N}".
 * - Debounce ~300 ms pada perubahan centang kolom agar permintaan tidak membanjiri backend,
 *   serta hanya kartu yang aktif untuk kombinasi kolom saat ini yang dirender dan memuat data.
 */
export const AnalyticsTab: React.FC = () => {
  const { datasetId: routeDatasetId = '' } = useParams<{ datasetId: string }>();
  const {
    dataset,
    isLoading: isDatasetLoading,
    refetchDataset,
  } = useOutletContext<WorkspaceOutletContext>();
  const navigate = useNavigate();

  const datasetId = String(dataset?.id || routeDatasetId);
  const cleanVersion = dataset?.versi_bersih ?? null;
  const hasCleanVersion =
    dataset !== undefined &&
    cleanVersion !== null &&
    cleanVersion !== undefined;

  // Pelacakan perubahan versi_bersih selama Tab 3 terbuka (Penyesuaian Wajib Butir k)
  const initialVersionRef = useRef<number | null>(null);
  const [updatedToVersionBanner, setUpdatedToVersionBanner] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (cleanVersion === null) return;
    if (initialVersionRef.current === null) {
      initialVersionRef.current = cleanVersion;
      return;
    }
    if (cleanVersion !== initialVersionRef.current) {
      setUpdatedToVersionBanner(cleanVersion);
      initialVersionRef.current = cleanVersion;
    }
  }, [cleanVersion]);

  // 1. Query Opsi Kolom & Filter (GET /datasets/{id}/compare/options)
  // HANYA dipanggil jika dataset sudah dibersihkan (hasCleanVersion === true)
  const {
    data: compareOptions,
    isLoading: isOptionsLoading,
    isFetching: isOptionsFetching,
    error: optionsError,
    refetch: refetchOptions,
  } = useQuery({
    queryKey: ['dataset-compare-options', datasetId, cleanVersion],
    queryFn: ({ signal }) => getCompareOptions(datasetId, signal),
    enabled: Boolean(datasetId) && hasCleanVersion,
    placeholderData: keepPreviousData,
  });

  // 2. Query Ikhtisar EDA & Korelasi (GET /datasets/{id}/eda)
  // HANYA dipanggil jika dataset sudah dibersihkan (hasCleanVersion === true)
  const {
    data: edaOverview,
    isLoading: isEdaLoading,
    isFetching: isEdaFetching,
    error: edaError,
    refetch: refetchEda,
  } = useQuery({
    queryKey: ['dataset-eda', datasetId, cleanVersion],
    queryFn: ({ signal }) => getEdaOverview(datasetId, signal),
    enabled: Boolean(datasetId) && hasCleanVersion,
    placeholderData: keepPreviousData,
  });

  // Daftar seluruh kolom beserta jenis dan penanda "(kemungkinan pengenal)" (Penyesuaian Wajib Butir g)
  const selectableColumns: SelectableColumnInfo[] = useMemo(() => {
    if (!compareOptions) return [];

    const detectedTime = compareOptions.kolom_waktu;
    const numericSet = new Set(compareOptions.kolom_angka);
    const categoryCols = compareOptions.kolom_kelompok.filter(
      (c) => c !== detectedTime && !numericSet.has(c)
    );

    const list: SelectableColumnInfo[] = [];

    // 1) Kolom Kategori [T]
    for (const col of categoryCols) {
      const catSummary = edaOverview?.ringkasan?.kategorikal?.[col];
      list.push({
        name: col,
        kind: 'category',
        isLikelyIdentifier: isLikelyIdentifierColumn(col),
        uniqueCount: catSummary?.unik,
        missingCount: catSummary?.kosong,
      });
    }

    // 2) Kolom Waktu [Tanggal] (jika terdeteksi)
    if (detectedTime) {
      list.push({
        name: detectedTime,
        kind: 'time',
        isLikelyIdentifier: false,
      });
    }

    // 3) Kolom Angka [123]
    for (const col of compareOptions.kolom_angka) {
      const numSummary = edaOverview?.ringkasan?.numerik?.[col];
      list.push({
        name: col,
        kind: 'numeric',
        isLikelyIdentifier: isLikelyIdentifierColumn(col),
        missingCount: numSummary?.kosong,
      });
    }

    return list;
  }, [compareOptions, edaOverview]);

  // State Pilihan Kolom di UI (segera merespons klik checkbox)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedNumerics, setSelectedNumerics] = useState<string[]>([]);
  const [selectedTimeColumn, setSelectedTimeColumn] = useState<string | null>(
    null
  );
  const [manualTimeColumn, setManualTimeColumn] = useState<string>('');
  const [aggregation, setAggregation] = useState<AggregationFunction>('sum');
  const [hasInitializedSelection, setHasInitializedSelection] =
    useState<boolean>(false);

  // Fungsi penentu pilihan kolom default yang menghindari kolom pengenal (id, kode, no, nomor) - Butir g
  const applySmartDefaults = useMemo(() => {
    return () => {
      if (!compareOptions) return;

      const detectedTime = compareOptions.kolom_waktu;
      const numericCols = compareOptions.kolom_angka;
      const categoryCols = compareOptions.kolom_kelompok.filter(
        (c) => c !== detectedTime && !numericCols.includes(c)
      );

      // Pilih 1 kolom kategori non-pengenal pertama (fallback ke kategori pertama jika semua pengenal)
      const nonIdCategories = categoryCols.filter(
        (c) => !isLikelyIdentifierColumn(c)
      );
      const defaultCategory =
        nonIdCategories[0] || categoryCols[0] || null;

      // Pilih hingga 2 kolom angka non-pengenal pertama (fallback ke kolom angka pertama)
      const nonIdNumerics = numericCols.filter(
        (c) => !isLikelyIdentifierColumn(c)
      );
      const defaultNumerics =
        nonIdNumerics.length > 0
          ? nonIdNumerics.slice(0, 2)
          : numericCols.slice(0, 2);

      setSelectedCategories(defaultCategory ? [defaultCategory] : []);
      setSelectedNumerics(defaultNumerics);
      setSelectedTimeColumn(detectedTime || null);
      setManualTimeColumn('');
      setAggregation('sum');
    };
  }, [compareOptions]);

  // Terapkan pilihan default saat compareOptions pertama kali selesai dimuat
  useEffect(() => {
    if (compareOptions && !hasInitializedSelection) {
      applySmartDefaults();
      setHasInitializedSelection(true);
    }
  }, [compareOptions, hasInitializedSelection, applySmartDefaults]);

  // State Pilihan Kolom yang di-debounce ~300 ms untuk pemanggilan query kartu grafik (Penyesuaian Wajib Butir h)
  const [debouncedSelection, setDebouncedSelection] = useState<{
    categories: string[];
    numerics: string[];
    timeCol: string | null;
    agg: AggregationFunction;
  }>({
    categories: [],
    numerics: [],
    timeCol: null,
    agg: 'sum',
  });

  useEffect(() => {
    const activeTime =
      compareOptions?.kolom_waktu !== null &&
      compareOptions?.kolom_waktu !== undefined
        ? selectedTimeColumn
        : manualTimeColumn || null;

    const timer = window.setTimeout(() => {
      setDebouncedSelection({
        categories: selectedCategories,
        numerics: selectedNumerics,
        timeCol: activeTime,
        agg: aggregation,
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    selectedCategories,
    selectedNumerics,
    selectedTimeColumn,
    manualTimeColumn,
    aggregation,
    compareOptions?.kolom_waktu,
  ]);

  // Handler Toggle Kolom di Panel Kiri
  const handleToggleCategory = (col: string) => {
    setSelectedCategories((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleToggleNumeric = (col: string) => {
    setSelectedNumerics((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleToggleTime = (col: string) => {
    if (!compareOptions?.kolom_waktu && manualTimeColumn === col) {
      setManualTimeColumn('');
      setSelectedTimeColumn(null);
      return;
    }
    setSelectedTimeColumn((prev) => (prev === col ? null : col));
  };

  const handleManualTimeColumnChange = (col: string) => {
    setManualTimeColumn(col);
    setSelectedTimeColumn(col || null);
  };

  const handleSwapPrimarySecondaryNumeric = () => {
    setSelectedNumerics((prev) => {
      if (prev.length < 2) return prev;
      const next = [...prev];
      const temp = next[0];
      next[0] = next[1];
      next[1] = temp;
      return next;
    });
  };

  // Variabel aktif dari debouncedSelection untuk mengendalikan kartu mana yang aktif
  const activePrimaryCategory = debouncedSelection.categories[0] || null;
  const activePrimaryNumeric = debouncedSelection.numerics[0] || null;
  const activeSecondaryNumeric = debouncedSelection.numerics[1] || null;
  const activeTertiaryNumeric = debouncedSelection.numerics[2] || null;
  const activeTimeCol = debouncedSelection.timeCol;
  const activeAgg = debouncedSelection.agg;

  // Evaluasi Kartu yang Aktif vs Kartu yang Disembunyikan beserta Penjelasan Singkat (Aturan Konten & Butir h)
  const showCategoryBarAndDonut =
    Boolean(activePrimaryCategory) && Boolean(activePrimaryNumeric);
  const showTrendAndTimeHeatmap =
    Boolean(activeTimeCol) && Boolean(activePrimaryNumeric);
  const showPeriodComparison =
    Boolean(activeTimeCol) &&
    Boolean(activePrimaryCategory) &&
    Boolean(activePrimaryNumeric) &&
    activePrimaryCategory !== activeTimeCol &&
    (compareOptions?.periode?.length ?? 0) >= 2;
  const showBubbleScatter =
    Boolean(activePrimaryCategory) &&
    Boolean(activePrimaryNumeric) &&
    Boolean(activeSecondaryNumeric);
  const showCorrelationMatrix = debouncedSelection.numerics.length >= 2;
  const showEdaDescriptiveSection =
    Boolean(activePrimaryNumeric) || Boolean(activePrimaryCategory);

  const hiddenCardsExplanations = useMemo(() => {
    const items: Array<{ card: string; reason: string }> = [];
    if (!showCategoryBarAndDonut) {
      items.push({
        card: 'Komparasi Kategori (Bar Chart) & Proporsi (Donut Chart)',
        reason:
          'Membutuhkan minimal 1 kolom kategori [T] dan 1 kolom angka [123].',
      });
    }
    if (!showTrendAndTimeHeatmap) {
      items.push({
        card: 'Tren Deret Waktu (Line Chart) & Heatmap Kelompok × Periode',
        reason:
          'Membutuhkan 1 kolom waktu [Tanggal] (atau Kolom Waktu Manual) dan minimal 1 kolom angka [123].',
      });
    }
    if (!showPeriodComparison) {
      items.push({
        card: 'Studio Komparasi Periode A vs Periode B',
        reason:
          'Membutuhkan 1 kolom waktu dengan minimal 2 periode, 1 kolom kategori [T], dan 1 kolom angka [123].',
      });
    }
    if (!showBubbleScatter) {
      items.push({
        card: 'Scatter / Bubble Chart Agregat Kelompok',
        reason:
          'Membutuhkan minimal 1 kolom kategori [T] dan minimal 2 kolom angka [123] (Sumbu X & Y).',
      });
    }
    if (!showCorrelationMatrix) {
      items.push({
        card: 'Matriks Korelasi Numerik Interaktif',
        reason: 'Membutuhkan minimal 2 kolom angka [123] dicentang bersamaan.',
      });
    }
    return items;
  }, [
    showCategoryBarAndDonut,
    showTrendAndTimeHeatmap,
    showPeriodComparison,
    showBubbleScatter,
    showCorrelationMatrix,
  ]);

  // 1. Kondisi Loading Metadata Dataset
  if (isDatasetLoading) {
    return (
      <div className="p-12 text-center text-sm text-text-muted-light dark:text-text-muted-dark">
        Memuat status dataset untuk Dashboard Analitik...
      </div>
    );
  }

  // 2. Kondisi Dataset Belum Dibersihkan (Aturan Konten: Tampilkan kondisi kosong dengan tombol menuju Tab 2, jangan memanggil endpoint analisis)
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
            Dashboard Analitik dan Galeri Diagram hanya bekerja pada versi data
            bersih (`CleanData`). Silakan jalankan pembersihan otomatis terlebih
            dahulu pada Tab 2.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={() =>
              navigate(`/workspace/${datasetId}/review-anomali`)
            }
          >
            Buka Tab 2: Review Anomali & Editor
          </Button>
        </div>
      </div>
    );
  }

  const optionsErrorMessage = optionsError
    ? (optionsError as Error & { localizedMessage?: string })
        ?.localizedMessage ||
      'Gagal memuat daftar opsi kolom analisis dari server backend.'
    : null;

  const edaErrorMessage = edaError
    ? (edaError as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal memuat ringkasan statistik EDA dari server backend.'
    : null;

  const activeCategoryUniqueCount = activePrimaryCategory
    ? edaOverview?.ringkasan?.kategorikal?.[activePrimaryCategory]?.unik
    : undefined;

  return (
    <div className="space-y-5 max-w-[1840px] mx-auto">
      {/* Baris Status Atas Tab 3: Status Data Terkini (Tanpa Pipeline ID, Tanpa klaim Sinkron Real-Time) */}
      <div className="p-3.5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {BACKEND_CAPABILITIES.B02_LIVE_SYNC_CHANNEL
                ? `Live Sync • Data Bersih v${cleanVersion}`
                : `Data terkini • Versi Bersih v${cleanVersion}`}
            </span>
          </span>

          <span className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
            Total Baris Bersih:{' '}
            <strong className="text-text-primary-light dark:text-text-primary-dark">
              {formatNumberId(
                edaOverview?.jumlah_baris ?? dataset?.baris_bersih,
                0
              )}
            </strong>
          </span>
        </div>

        {/* Banner Catatan Singkat HANYA jika versi_bersih berubah selama Tab 3 terbuka (Penyesuaian Wajib Butir k) */}
        {updatedToVersionBanner !== null && (
          <div
            role="status"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-button bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 text-xs font-semibold text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark"
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Data bersih diperbarui ke v{updatedToVersionBanner}</span>
            <button
              type="button"
              onClick={() => setUpdatedToVersionBanner(null)}
              className="ml-2 underline hover:opacity-80"
            >
              Tutup
            </button>
          </div>
        )}
      </div>

      {/* Penanganan Error Tingkat Opsi Kolom (Misal Backend Mati Saat Baru Membuka Tab 3) */}
      {optionsErrorMessage && !compareOptions ? (
        <div className="p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                Tidak Dapat Memuat Opsi Kolom Analisis
              </h2>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                {optionsErrorMessage}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => {
              refetchOptions();
              refetchEda();
              refetchDataset();
            }}
          >
            Coba Lagi
          </Button>
        </div>
      ) : (
        /* Tata Letak Utama: Panel Pemilih Kolom Kiri (290px) + Galeri Kartu Kanan */
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Panel Bilah Sisi Pemilih Kolom Reaktif (F-34) */}
          <ColumnSelectorSidebar
            columns={selectableColumns}
            selectedCategories={selectedCategories}
            selectedNumerics={selectedNumerics}
            selectedTimeColumn={selectedTimeColumn}
            detectedTimeColumn={compareOptions?.kolom_waktu ?? null}
            manualTimeColumn={manualTimeColumn}
            onManualTimeColumnChange={handleManualTimeColumnChange}
            onToggleCategory={handleToggleCategory}
            onToggleNumeric={handleToggleNumeric}
            onToggleTime={handleToggleTime}
            onSwapPrimarySecondaryNumeric={handleSwapPrimarySecondaryNumeric}
            aggregation={aggregation}
            onAggregationChange={setAggregation}
            onResetDefaults={applySmartDefaults}
          />

          {/* Area Galeri Kartu Analitik Adaptif */}
          <div className="flex-1 min-w-0 w-full space-y-6">
            {isOptionsLoading && !compareOptions ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-pulse">
                <div className="h-80 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                <div className="h-80 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
              </div>
            ) : !activePrimaryNumeric && !activePrimaryCategory ? (
              /* Kondisi Kosong bila Tidak Ada Kolom yang Dicentang */
              <div className="p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-3">
                <BarChart2 className="w-8 h-8 text-brand-primary-light dark:text-brand-primary-dark mx-auto" />
                <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                  Belum Ada Kolom Analisis yang Dipilih
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
                  Centang minimal satu kolom angka [123] beserta kolom kategori
                  [T] atau waktu [Tanggal] pada panel di sebelah kiri untuk
                  menampilkan diagram secara otomatis.
                </p>
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    icon={<RotateCcw className="w-4 h-4" />}
                    onClick={applySmartDefaults}
                  >
                    Kembalikan ke Pilihan Default
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 1 & 2. Kartu Komparasi Kategori (Bar Chart) & Proporsi Indikator (Donut Chart) */}
                {showCategoryBarAndDonut &&
                  activePrimaryNumeric &&
                  activePrimaryCategory && (
                    <CategoryBarAndDonutCards
                      datasetId={datasetId}
                      datasetName={dataset?.nama}
                      cleanVersion={cleanVersion}
                      primaryNumeric={activePrimaryNumeric}
                      primaryCategory={activePrimaryCategory}
                      timeColumn={activeTimeCol}
                      aggregation={activeAgg}
                    />
                  )}

                {/* 3 & 5. Kartu Tren Historis Deret Waktu (Line Chart) & Heatmap Kelompok × Periode */}
                {showTrendAndTimeHeatmap &&
                  activePrimaryNumeric &&
                  activeTimeCol && (
                    <TrendLineAndTimeHeatmapCards
                      datasetId={datasetId}
                      datasetName={dataset?.nama}
                      cleanVersion={cleanVersion}
                      primaryNumeric={activePrimaryNumeric}
                      secondaryNumeric={activeSecondaryNumeric}
                      primaryCategory={activePrimaryCategory}
                      timeColumn={activeTimeCol}
                      categoryUniqueCount={activeCategoryUniqueCount}
                      aggregation={activeAgg}
                    />
                  )}

                {/* F-21, F-22, F-25: Statistik Deskriptif 5 Angka, Distribusi Histogram, & Kalkulator Rasio */}
                {showEdaDescriptiveSection && (
                  <EdaDescriptiveHistRatioSection
                    datasetId={datasetId}
                    datasetName={dataset?.nama}
                    cleanVersion={cleanVersion}
                    primaryNumeric={activePrimaryNumeric}
                    secondaryNumeric={activeSecondaryNumeric}
                    primaryCategory={activePrimaryCategory}
                    timeColumn={activeTimeCol}
                    numericSummaries={edaOverview?.ringkasan?.numerik || {}}
                    categoricalSummaries={
                      edaOverview?.ringkasan?.kategorikal || {}
                    }
                    isEdaLoading={isEdaLoading}
                    isEdaFetching={isEdaFetching || isOptionsFetching}
                    edaErrorMessage={edaErrorMessage}
                    onRetryEda={() => refetchEda()}
                  />
                )}

                {/* 6. Kartu Scatter / Bubble Chart & Matriks Korelasi (F-21) */}
                {(showBubbleScatter || showCorrelationMatrix) && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {showBubbleScatter &&
                      activePrimaryNumeric &&
                      activeSecondaryNumeric &&
                      activePrimaryCategory && (
                        <GroupBubbleScatterCard
                          datasetId={datasetId}
                          datasetName={dataset?.nama}
                          cleanVersion={cleanVersion}
                          primaryNumeric={activePrimaryNumeric}
                          secondaryNumeric={activeSecondaryNumeric}
                          tertiaryNumeric={activeTertiaryNumeric}
                          primaryCategory={activePrimaryCategory}
                          timeColumn={activeTimeCol}
                          aggregation={activeAgg}
                        />
                      )}

                    {showCorrelationMatrix && (
                      <CorrelationMatrixCard
                        datasetName={dataset?.nama}
                        selectedNumericColumns={debouncedSelection.numerics}
                        correlationMatrix={
                          edaOverview?.korelasi?.matriks || {}
                        }
                        topPairs={
                          edaOverview?.korelasi?.pasangan_teratas || []
                        }
                        isLoading={isEdaLoading}
                        isFetching={isEdaFetching}
                        errorMessage={edaErrorMessage}
                        onRetry={() => refetchEda()}
                      />
                    )}
                  </div>
                )}

                {/* F-24: Studio Komparasi Pertumbuhan Periode A vs Periode B */}
                {showPeriodComparison &&
                  activePrimaryNumeric &&
                  activePrimaryCategory &&
                  activeTimeCol && (
                    <PeriodComparisonCard
                      datasetId={datasetId}
                      datasetName={dataset?.nama}
                      cleanVersion={cleanVersion}
                      primaryNumeric={activePrimaryNumeric}
                      primaryCategory={activePrimaryCategory}
                      timeColumn={activeTimeCol}
                      availablePeriods={compareOptions?.periode || []}
                      aggregation={activeAgg}
                    />
                  )}

                {/* Penjelasan Singkat Kartu yang Disembunyikan karena Pilihan Kolom Saat Ini */}
                {hiddenCardsExplanations.length > 0 && (
                  <div className="p-4 rounded-card bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                      <EyeOff className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
                      <span>
                        Kartu yang Disembunyikan karena Pilihan Kolom Saat Ini (
                        {formatNumberId(hiddenCardsExplanations.length, 0)})
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {hiddenCardsExplanations.map((item) => (
                        <li key={item.card}>
                          <strong className="text-text-primary-light dark:text-text-primary-dark">
                            {item.card}:
                          </strong>{' '}
                          {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4, 7, & 8. Tiga Kartu Galeri di Balik Saklar B-07 (Bagian Bawah Galeri) */}
                <B07GalleryCardsSection
                  datasetId={datasetId}
                  datasetName={dataset?.nama}
                  cleanVersion={cleanVersion}
                  selectedCategories={debouncedSelection.categories}
                  primaryNumeric={activePrimaryNumeric}
                  aggregation={activeAgg}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;
