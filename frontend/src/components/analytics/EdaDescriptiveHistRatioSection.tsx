import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  BarChart2,
  Calculator,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ChartCardShell } from './ChartCardShell';
import { FullscreenChartModal } from './FullscreenChartModal';
import {
  getEdaDistribution,
  getRatioAnalysis,
} from '@/services/analyticsService';
import {
  EdaCategoricalColumnSummary,
  EdaNumericColumnSummary,
} from '@/types/analytics';
import { formatNumberId, formatRatioMultiplierId } from '@/utils/formatters';

export interface EdaDescriptiveHistRatioSectionProps {
  datasetId: string;
  datasetName?: string | null;
  cleanVersion: number | null;
  primaryNumeric: string | null;
  secondaryNumeric: string | null;
  primaryCategory: string | null;
  timeColumn: string | null;
  numericSummaries: Record<string, EdaNumericColumnSummary>;
  categoricalSummaries: Record<string, EdaCategoricalColumnSummary>;
  isEdaLoading: boolean;
  isEdaFetching?: boolean;
  edaErrorMessage?: string | null;
  onRetryEda?: () => void;
}

/**
 * Seksi Analitik Statistik Deskriptif 5 Angka (F-21), Distribusi Histogram Bins (F-22),
 * dan Kalkulator Rasio Indikator (F-25).
 *
 * Mematuhi Aturan Konten & Penyesuaian Wajib:
 * - Statistik 5 angka + Mean, Std. Deviasi, N, Kosong, dan IQR = Q3 - Q1 (dengan tooltip definisi singkat).
 * - Histogram dengan slider Bins yang di-debounce ~300 ms, skor Skewness dari backend, dan garis Mean/Median.
 * - Kalkulator Rasio tanpa klaim "Standar Nasional", tanpa klaim "Kondisi Ideal", dan tanpa tombol
 *   "Simulasi Perubahan Rasio". Menampilkan `rasio_keseluruhan`, `rata_rata_rasio`, toggle format `x` vs `%`,
 *   pilihan batas kategori (`10`, `15`, `25`, `Semua hingga 50`), grafik batang rincian per kelompok,
 *   serta narasi `deskripsi` dari backend apa adanya.
 */
export const EdaDescriptiveHistRatioSection: React.FC<
  EdaDescriptiveHistRatioSectionProps
> = ({
  datasetId,
  datasetName,
  cleanVersion,
  primaryNumeric,
  secondaryNumeric,
  primaryCategory,
  timeColumn,
  numericSummaries,
  categoricalSummaries,
  isEdaLoading,
  isEdaFetching,
  edaErrorMessage,
  onRetryEda,
}) => {
  // State Slider Bins Histogram (dengan debounce 300 ms sesuai Butir h)
  const [rawBins, setRawBins] = useState<number>(10);
  const [debouncedBins, setDebouncedBins] = useState<number>(10);
  const [isHistFullscreen, setIsHistFullscreen] = useState(false);

  // State Kalkulator Rasio (F-25)
  const [asPercent, setAsPercent] = useState<boolean>(false);
  const [ratioTopLimit, setRatioTopLimit] = useState<number>(15);
  const [isRatioFullscreen, setIsRatioFullscreen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedBins(rawBins);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [rawBins]);

  const activeNumericSummary = primaryNumeric
    ? numericSummaries[primaryNumeric]
    : undefined;

  // Hitung IQR = Q3 - Q1 hanya jika Q3 dan Q1 tersedia
  const iqrValue = useMemo(() => {
    if (
      activeNumericSummary &&
      activeNumericSummary.q3 !== null &&
      activeNumericSummary.q1 !== null
    ) {
      return Number(
        (activeNumericSummary.q3 - activeNumericSummary.q1).toFixed(4)
      );
    }
    return null;
  }, [activeNumericSummary]);

  // Query F-22: GET /datasets/{id}/eda/distribution
  const {
    data: distData,
    isLoading: isDistLoading,
    isFetching: isDistFetching,
    error: distError,
    refetch: refetchDist,
  } = useQuery({
    queryKey: [
      'dataset-eda-distribution',
      datasetId,
      cleanVersion,
      primaryNumeric,
      debouncedBins,
    ],
    queryFn: ({ signal }) =>
      getEdaDistribution(
        datasetId,
        {
          kolom: primaryNumeric!,
          bins: debouncedBins,
        },
        signal
      ),
    enabled: Boolean(datasetId) && Boolean(primaryNumeric),
    placeholderData: keepPreviousData,
  });

  const distErrorMessage = distError
    ? (distError as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal memuat distribusi histogram.'
    : null;

  // Kelompok untuk rasio: gunakan primaryCategory, atau timeColumn jika kategori tidak dicentang
  const ratioGroupCol = primaryCategory || timeColumn || null;
  const canFetchRatio =
    Boolean(datasetId) &&
    Boolean(primaryNumeric) &&
    Boolean(secondaryNumeric) &&
    Boolean(ratioGroupCol);

  // Query F-25: GET /datasets/{id}/ratio (ambil tanpa top agar tahu total kelompok, lalu potong di UI)
  const {
    data: ratioData,
    isLoading: isRatioLoading,
    isFetching: isRatioFetching,
    error: ratioError,
    refetch: refetchRatio,
  } = useQuery({
    queryKey: [
      'dataset-ratio',
      datasetId,
      cleanVersion,
      primaryNumeric,
      secondaryNumeric,
      ratioGroupCol,
      timeColumn,
      asPercent,
    ],
    queryFn: ({ signal }) =>
      getRatioAnalysis(
        datasetId,
        {
          pembilang: primaryNumeric!,
          penyebut: secondaryNumeric!,
          kelompok: ratioGroupCol!,
          sebagai_persen: asPercent,
          waktu: timeColumn,
          urut: 'desc',
        },
        signal
      ),
    enabled: canFetchRatio,
    placeholderData: keepPreviousData,
  });

  const ratioErrorMessage = ratioError
    ? (ratioError as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal menghitung rasio indikator.'
    : null;

  // Format data histogram untuk Recharts
  const histogramChartData = useMemo(() => {
    if (!distData?.bins) return [];
    return distData.bins.map((b) => ({
      rentang: `${formatNumberId(b.dari, 1)} – ${formatNumberId(b.sampai, 1)}`,
      titikTengah:
        b.dari !== null && b.sampai !== null
          ? Number(((b.dari + b.sampai) / 2).toFixed(2))
          : 0,
      dari: b.dari,
      sampai: b.sampai,
      jumlah: b.jumlah,
    }));
  }, [distData]);

  // Data rasio yang dipotong sesuai pilihan batas (10, 15, 25, 50)
  const allRatioItems = ratioData?.data || [];
  const validRatioItems = allRatioItems.filter((item) => item.rasio !== null);
  const displayedRatioItems = validRatioItems.slice(0, ratioTopLimit);
  const ratioTruncationNote =
    validRatioItems.length > ratioTopLimit
      ? `Menampilkan ${formatNumberId(
          displayedRatioItems.length,
          0
        )} teratas dari ${formatNumberId(validRatioItems.length, 0)} kelompok`
      : null;

  const renderHistogramChart = (height: number) => (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={histogramChartData}
          margin={{ top: 14, right: 16, left: 8, bottom: 44 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="rentang"
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            angle={-22}
            textAnchor="end"
            interval="preserveStartEnd"
            height={52}
          />
          <YAxis
            allowDecimals={false}
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            tickFormatter={(v) => formatNumberId(Number(v), 0)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
            }}
            formatter={(val: unknown) => [
              `${formatNumberId(typeof val === 'number' ? val : 0, 0)} baris`,
              'Frekuensi',
            ]}
          />
          <Bar
            dataKey="jumlah"
            name="Frekuensi"
            fill="var(--color-brand-cyan)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderRatioChart = (height: number) => (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={displayedRatioItems}
          layout="vertical"
          margin={{ top: 8, right: 28, left: 12, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            tickFormatter={(v) =>
              `${formatNumberId(Number(v), 2)}${asPercent ? '%' : 'x'}`
            }
          />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{
              fill: 'var(--color-text-primary)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
            }}
            formatter={(val: unknown) => [
              `${formatNumberId(typeof val === 'number' ? val : null, 2)}${
                asPercent ? ' %' : ' x'
              }`,
              `Rasio ${primaryNumeric} / ${secondaryNumeric}`,
            ]}
          />
          {ratioData?.rasio_keseluruhan !== null &&
            ratioData?.rasio_keseluruhan !== undefined && (
              <ReferenceLine
                x={ratioData.rasio_keseluruhan}
                stroke="var(--color-brand-violet)"
                strokeDasharray="4 4"
              />
            )}
          <Bar
            dataKey="rasio"
            name="Rasio"
            fill="var(--color-brand-primary)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Grid 3 Modul Analitik: 1) Statistik 5 Angka (F-21), 2) Histogram (F-22), 3) Kalkulator Rasio (F-25) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
        {/* KARTU 1: Statistik Deskriptif 5 Angka & Profil Kategorikal (F-21) */}
        <section
          aria-label="Statistik Deskriptif 5 Angka dan Profil Kategorikal"
          className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-border-light dark:border-border-dark flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Statistik Deskriptif 5 Angka
                </h3>
                <p className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                  {primaryNumeric
                    ? `Variabel: ${primaryNumeric}`
                    : primaryCategory
                    ? `Profil Kategori: ${primaryCategory}`
                    : 'Pilih kolom untuk melihat ringkasan'}
                </p>
              </div>
            </div>

            {activeNumericSummary && (
              <span
                title="Jumlah baris dengan nilai numerik valid (tidak kosong) pada kolom ini"
                className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark tabular-numbers flex-shrink-0"
              >
                N = {formatNumberId(activeNumericSummary.jumlah, 0)}
              </span>
            )}
          </div>

          <div className="p-4 flex-1 space-y-4">
            {isEdaLoading ? (
              <div className="space-y-2.5 animate-pulse">
                <div className="h-6 rounded bg-header-light dark:bg-header-dark" />
                <div className="h-6 rounded bg-header-light dark:bg-header-dark" />
                <div className="h-6 rounded bg-header-light dark:bg-header-dark" />
                <div className="h-6 rounded bg-header-light dark:bg-header-dark" />
              </div>
            ) : edaErrorMessage ? (
              <div className="p-4 rounded-button bg-anomaly-danger-bg-light/50 dark:bg-anomaly-danger-bg-dark/40 text-sm text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark space-y-2.5">
                <p>{edaErrorMessage}</p>
                {onRetryEda && (
                  <Button variant="secondary" onClick={onRetryEda}>
                    Coba Lagi
                  </Button>
                )}
              </div>
            ) : activeNumericSummary ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" aria-label="Tabel Statistik Deskriptif 5 Angka">
                  <thead>
                    <tr className="border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                      <th scope="col" className="py-2 pr-2">Parameter Statistik</th>
                      <th scope="col" className="py-2 pl-2 text-right font-mono">
                        Nilai (N={formatNumberId(activeNumericSummary.jumlah, 0)})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Mean (Rata-rata)
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(activeNumericSummary.rata_rata, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Median (Kuartil 2)
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(activeNumericSummary.median, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Std. Deviasi
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(activeNumericSummary.std, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Minimum
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(activeNumericSummary.min, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Q1 (Kuartil Bawah 25%)
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(activeNumericSummary.q1, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Q3 (Kuartil Atas 75%)
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(activeNumericSummary.q3, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Maksimum
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-bold tabular-numbers text-brand-primary-light dark:text-brand-primary-dark">
                        {formatNumberId(activeNumericSummary.max, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        <span
                          className="inline-flex items-center gap-1 cursor-help"
                          title="Rentang Interkuartil (IQR) = Q3 dikurangi Q1, dibulatkan hingga 2 angka desimal."
                        >
                          <span>Interquartile (IQR)</span>
                          <HelpCircle className="w-3.5 h-3.5 text-text-muted-light dark:text-text-secondary-dark" />
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                        {formatNumberId(iqrValue, 2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-2 text-text-secondary-light dark:text-text-secondary-dark">
                        Sel Kosong
                      </td>
                      <td className="py-2 pl-2 text-right font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                        {formatNumberId(activeNumericSummary.kosong, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-text-muted-light dark:text-text-secondary-dark">
                Centang minimal satu kolom angka [123] di panel kiri untuk
                melihat ringkasan 5 angka.
              </p>
            )}

            {/* Nilai Teratas Kategorikal (F-21) jika kolom kategori dicentang */}
            {primaryCategory && categoricalSummaries[primaryCategory] && (
              <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                    Nilai Teratas: {primaryCategory}
                  </span>
                  <span className="font-mono text-text-muted-light dark:text-text-secondary-dark tabular-numbers">
                    {formatNumberId(
                      categoricalSummaries[primaryCategory].unik,
                      0
                    )}{' '}
                    unik •{' '}
                    {formatNumberId(
                      categoricalSummaries[primaryCategory].kosong,
                      0
                    )}{' '}
                    kosong
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categoricalSummaries[primaryCategory].teratas.map((t) => (
                    <span
                      key={t.nilai}
                      className="px-2.5 py-1 rounded-full text-xs font-mono bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark tabular-numbers"
                    >
                      {t.nilai} ({formatNumberId(t.jumlah, 0)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* KARTU 2: Distribusi Nilai / Histogram Bins */}
        <ChartCardShell
          title="Distribusi Histogram Nilai"
          subtitle={
            primaryNumeric
              ? `Sebaran frekuensi ${primaryNumeric} (${formatNumberId(
                  debouncedBins,
                  0
                )} bins)`
              : 'Pilih kolom angka untuk melihat histogram'
          }
          chartTypeSlug="distribusi_histogram"
          datasetName={datasetName}
          icon={<BarChart2 className="w-5 h-5" />}
          ariaSummary={`Histogram distribusi nilai untuk kolom ${
            primaryNumeric || '-'
          } dengan ${debouncedBins} interval bin dan skewness ${formatNumberId(
            distData?.skewness,
            2
          )}.`}
          isLoading={isDistLoading || isEdaLoading}
          isFetching={isDistFetching || isEdaFetching}
          errorMessage={distErrorMessage}
          onRetry={() => refetchDist()}
          isConditionUnmet={!primaryNumeric}
          conditionExplanation="Centang minimal satu kolom angka [123] di panel kiri untuk menampilkan histogram distribusi nilai."
          onOpenFullscreen={() => setIsHistFullscreen(true)}
        >
          <div className="space-y-3">
            {/* Baris Kontrol Bins & Skor Skewness */}
            <div className="p-2.5 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono">
                <span className="text-text-secondary-light dark:text-text-secondary-dark">
                  Skewness:{' '}
                </span>
                <strong className="text-brand-primary-light dark:text-brand-primary-dark tabular-numbers">
                  {distData?.skewness !== null &&
                  distData?.skewness !== undefined &&
                  distData.skewness > 0
                    ? `+${formatNumberId(distData.skewness, 2)}`
                    : formatNumberId(distData?.skewness, 2)}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="histogram-bins-slider"
                  className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark font-mono tabular-numbers"
                >
                  Bins: {formatNumberId(rawBins, 0)}
                </label>
                <input
                  id="histogram-bins-slider"
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={rawBins}
                  onChange={(e) => setRawBins(Number(e.target.value))}
                  className="w-24 accent-brand-primary-light dark:accent-brand-primary-dark cursor-pointer"
                />
              </div>
            </div>

            {renderHistogramChart(220)}

            {/* Ringkasan Mean & Median di bawah Histogram */}
            {activeNumericSummary && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark tabular-numbers px-1">
                <span>
                  Minimum: <strong>{formatNumberId(activeNumericSummary.min, 2)}</strong>
                </span>
                <span className="text-brand-primary-light dark:text-brand-primary-dark font-semibold">
                  Rata-rata: {formatNumberId(activeNumericSummary.rata_rata, 2)}
                </span>
                <span>
                  Median: <strong>{formatNumberId(activeNumericSummary.median, 2)}</strong>
                </span>
                <span>
                  Maksimum: <strong>{formatNumberId(activeNumericSummary.max, 2)}</strong>
                </span>
              </div>
            )}
          </div>
        </ChartCardShell>

        {/* KARTU 3: Kalkulator Rasio Indikator */}
        <ChartCardShell
          title="Kalkulator Rasio Indikator"
          subtitle={
            primaryNumeric && secondaryNumeric && ratioGroupCol
              ? `Rasio ${primaryNumeric} / ${secondaryNumeric} per ${ratioGroupCol}`
              : 'Membutuhkan 2 kolom angka dan 1 kolom pengelompokan'
          }
          chartTypeSlug="kalkulator_rasio"
          datasetName={datasetName}
          icon={<Calculator className="w-5 h-5" />}
          ariaSummary={
            ratioData?.deskripsi ||
            `Kalkulator rasio antara ${primaryNumeric || '-'} dan ${
              secondaryNumeric || '-'
            }.`
          }
          truncationNote={ratioTruncationNote}
          narrativeText={ratioData?.deskripsi || null}
          isLoading={isRatioLoading}
          isFetching={isRatioFetching}
          errorMessage={ratioErrorMessage}
          onRetry={() => refetchRatio()}
          isConditionUnmet={!canFetchRatio}
          conditionExplanation="Centang minimal 2 kolom angka [123] (sebagai pembilang dan penyebut) serta 1 kolom kategori [T] atau waktu [Tanggal] di panel kiri untuk menghitung rasio."
          onOpenFullscreen={() => setIsRatioFullscreen(true)}
        >
          <div className="space-y-3">
            {/* Kontrol Format Rasio (Desimal x vs Persen %) & Batas Tampilan */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="inline-flex p-1 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark"
                role="group"
                aria-label="Pilih satuan format rasio"
              >
                <button
                  type="button"
                  aria-pressed={!asPercent}
                  onClick={() => setAsPercent(false)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-button transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
                    !asPercent
                      ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark shadow-sm'
                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  Kelipatan (x)
                </button>
                <button
                  type="button"
                  aria-pressed={asPercent}
                  onClick={() => setAsPercent(true)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-button transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
                    asPercent
                      ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark shadow-sm'
                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  Persentase (%)
                </button>
              </div>

              <select
                aria-label="Batas jumlah kelompok rasio yang ditampilkan"
                value={ratioTopLimit}
                onChange={(e) => setRatioTopLimit(Number(e.target.value))}
                className="px-2.5 py-1.5 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark min-h-control"
              >
                <option value={10}>10 Teratas</option>
                <option value={15}>15 Teratas</option>
                <option value={25}>25 Teratas</option>
                <option value={50}>Semua (Maks 50)</option>
              </select>
            </div>

            {/* Kotak Angka Rasio Keseluruhan & Rata-rata Rasio */}
            {ratioData && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-button bg-header-light/70 dark:bg-header-dark/70 border border-border-light dark:border-border-dark">
                  <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Rasio Keseluruhan
                  </span>
                  <span className="block text-xl font-bold font-mono tabular-numbers text-brand-primary-light dark:text-brand-primary-dark mt-0.5">
                    {ratioData.satuan === '%'
                      ? `${formatNumberId(ratioData.rasio_keseluruhan, 2)}%`
                      : formatRatioMultiplierId(ratioData.rasio_keseluruhan)}
                  </span>
                </div>

                <div className="p-3 rounded-button bg-header-light/70 dark:bg-header-dark/70 border border-border-light dark:border-border-dark">
                  <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Rata-rata per Kelompok
                  </span>
                  <span className="block text-xl font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-0.5">
                    {ratioData.satuan === '%'
                      ? `${formatNumberId(ratioData.rata_rata_rasio, 2)}%`
                      : formatRatioMultiplierId(ratioData.rata_rata_rasio)}
                  </span>
                </div>
              </div>
            )}

            {/* Grafik Batang Rincian Rasio per Kelompok */}
            {renderRatioChart(180)}
          </div>
        </ChartCardShell>
      </div>

      {/* Modal Layar Penuh Histogram */}
      <FullscreenChartModal
        isOpen={isHistFullscreen}
        onClose={() => setIsHistFullscreen(false)}
        title="Distribusi Histogram Nilai"
        subtitle={`Sebaran frekuensi ${primaryNumeric || '-'} (${formatNumberId(
          debouncedBins,
          0
        )} bins)`}
        chartTypeSlug="distribusi_histogram"
        datasetName={datasetName}
      >
        {renderHistogramChart(440)}
      </FullscreenChartModal>

      {/* Modal Layar Penuh Kalkulator Rasio */}
      <FullscreenChartModal
        isOpen={isRatioFullscreen}
        onClose={() => setIsRatioFullscreen(false)}
        title="Kalkulator Rasio Indikator"
        subtitle={`Rasio ${primaryNumeric || '-'} / ${
          secondaryNumeric || '-'
        } per ${ratioGroupCol || '-'}`}
        chartTypeSlug="kalkulator_rasio"
        datasetName={datasetName}
        truncationNote={ratioTruncationNote}
        narrativeText={ratioData?.deskripsi || null}
      >
        {renderRatioChart(460)}
      </FullscreenChartModal>
    </div>
  );
};
