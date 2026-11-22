import React, { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  SunburstChart,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart2,
  CircleDot,
  Grid,
  HelpCircle,
  Layers,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Share2,
  Sun,
} from 'lucide-react';
import { ChartCardShell } from './ChartCardShell';
import { FullscreenChartModal } from './FullscreenChartModal';
import { AGGREGATION_LABELS } from './ColumnSelectorSidebar';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  getCompareCategory,
  getEdaTrend,
  getHierarchyAnalysis,
  getMatrix2DAnalysis,
} from '@/services/analyticsService';
import {
  AggregationFunction,
  CompareCategoryItem,
  EdaTrendPoint,
} from '@/types/analytics';
import { formatNumberId, formatPercentId } from '@/utils/formatters';

/**
 * Palet Turunan Warna Hanya dari Token Visualisasi Design System (Penyesuaian Wajib Butir e):
 * - Hanya memakai 3 token warna visualisasi:
 *   1. Royal Blue (`var(--color-brand-primary)`)
 *   2. Cyan (`var(--color-brand-cyan)`)
 *   3. Violet (`var(--color-brand-violet)`)
 * - Turunan terang/gelap dibuat melalui `fillOpacity` / `strokeOpacity`, tanpa kode hex baru.
 */
const DONUT_TOKEN_SLICES: Array<{
  fill: string;
  fillOpacity: number;
}> = [
  { fill: 'var(--color-brand-primary)', fillOpacity: 1 },
  { fill: 'var(--color-brand-cyan)', fillOpacity: 1 },
  { fill: 'var(--color-brand-violet)', fillOpacity: 1 },
  { fill: 'var(--color-brand-primary)', fillOpacity: 0.75 },
  { fill: 'var(--color-brand-cyan)', fillOpacity: 0.75 },
  { fill: 'var(--color-brand-violet)', fillOpacity: 0.75 },
  { fill: 'var(--color-brand-primary)', fillOpacity: 0.52 },
  { fill: 'var(--color-brand-cyan)', fillOpacity: 0.52 },
  { fill: 'var(--color-brand-violet)', fillOpacity: 0.45 }, // Untuk irisan ke-9 ("Lainnya")
];

/**
 * Maksimal 5 seri pada Grafik Garis (Penyesuaian Wajib Butir e):
 * Mengombinasikan 3 token warna dengan gaya garis solid & putus-putus (`strokeDasharray`).
 */
const LINE_SERIES_STYLES: Array<{
  stroke: string;
  strokeDasharray?: string;
}> = [
  { stroke: 'var(--color-brand-primary)' },
  { stroke: 'var(--color-brand-cyan)', strokeDasharray: '6 4' },
  { stroke: 'var(--color-brand-violet)' },
  { stroke: 'var(--color-brand-primary)', strokeDasharray: '3 3' },
  { stroke: 'var(--color-brand-violet)', strokeDasharray: '8 4 2 4' },
];

/**
 * Perhitungan CAGR Ketat (Penyesuaian Wajib Butir c):
 * - Hanya tampil jika SEMUA periode berupa bilangan bulat tahun (4 digit wajar, mis. 1900..2100),
 *   nilai awal > 0, nilai akhir > 0, dan ada minimal dua tahun berbeda (tahunAkhir > tahunAwal).
 * - Rumus memakai SELISIH TAHUN sebenarnya: (V_akhir / V_awal)^(1 / (tahunAkhir - tahunAwal)) - 1.
 */
function computeStrictAnnualCagr(points: EdaTrendPoint[]): {
  cagrPercent: number;
  startYear: number;
  endYear: number;
  yearDiff: number;
  startVal: number;
  endVal: number;
} | null {
  const validPoints = points.filter(
    (p) => p.nilai !== null && p.nilai !== undefined && !Number.isNaN(p.nilai)
  );
  if (validPoints.length < 2) return null;

  const parsedYears: Array<{ year: number; val: number }> = [];
  for (const pt of validPoints) {
    const rawStr = String(pt.periode).trim();
    if (!/^\d{4}$/.test(rawStr)) {
      return null;
    }
    const yr = Number(rawStr);
    if (!Number.isInteger(yr) || yr < 1800 || yr > 2200) {
      return null;
    }
    parsedYears.push({ year: yr, val: Number(pt.nilai) });
  }

  parsedYears.sort((a, b) => a.year - b.year);
  const first = parsedYears[0];
  const last = parsedYears[parsedYears.length - 1];
  const yearDiff = last.year - first.year;

  if (yearDiff < 1 || first.val <= 0 || last.val <= 0) {
    return null;
  }

  const cagr = Math.pow(last.val / first.val, 1 / yearDiff) - 1;
  if (!Number.isFinite(cagr)) return null;

  return {
    cagrPercent: Number((cagr * 100).toFixed(2)),
    startYear: first.year,
    endYear: last.year,
    yearDiff,
    startVal: first.val,
    endVal: last.val,
  };
}

// ============================================================================
// 1. KARTU KOMPARASI ANTAR-KATEGORI (BAR CHART) & 2. PROPORSI INDIKATOR (DONUT)
// ============================================================================

export interface CategoryBarAndDonutCardsProps {
  datasetId: string;
  datasetName?: string | null;
  cleanVersion: number | null;
  primaryNumeric: string;
  primaryCategory: string;
  timeColumn: string | null;
  aggregation: AggregationFunction;
}

export const CategoryBarAndDonutCards: React.FC<
  CategoryBarAndDonutCardsProps
> = ({
  datasetId,
  datasetName,
  cleanVersion,
  primaryNumeric,
  primaryCategory,
  timeColumn,
  aggregation,
}) => {
  const [barTopLimit, setBarTopLimit] = useState<number>(15);
  const [isBarFullscreen, setIsBarFullscreen] = useState(false);
  const [isDonutFullscreen, setIsDonutFullscreen] = useState(false);

  // Penyesuaian Wajib Butir a:
  // Ambil SEMUA kelompok dari GET /compare (tanpa parameter top, dengan urut='desc')
  // agar bisa memeriksa seluruh nilai untuk Donut dan memotong Bar Chart di sisi klien.
  const {
    data: compareData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'dataset-compare-full',
      datasetId,
      cleanVersion,
      primaryNumeric,
      primaryCategory,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getCompareCategory(
        datasetId,
        {
          nilai: primaryNumeric,
          kelompok: primaryCategory,
          agg: aggregation,
          waktu: timeColumn,
          urut: 'desc',
        },
        signal
      ),
    enabled:
      Boolean(datasetId) && Boolean(primaryNumeric) && Boolean(primaryCategory),
    placeholderData: keepPreviousData,
  });

  const errorMessage = error
    ? (error as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal memuat komparasi kategori.'
    : null;

  const allItems = compareData?.data || [];
  const totalGroups = compareData?.jumlah_kelompok ?? allItems.length;

  // Data untuk Bar Chart: dipotong menurut barTopLimit (default 15, pilihan 10, 15, 25, Semua hingga 50)
  const barItems = useMemo(
    () => allItems.slice(0, barTopLimit),
    [allItems, barTopLimit]
  );
  const barTruncationNote =
    totalGroups > barItems.length
      ? `Menampilkan ${formatNumberId(
          barItems.length,
          0
        )} teratas dari ${formatNumberId(totalGroups, 0)} kelompok`
      : null;

  // Evaluasi Kelayakan Donut Chart (Penyesuaian Wajib Butir a):
  // 1) agg harus 'sum'
  // 2) jumlah kelompok <= 500 dan > 0
  // 3) semua nilai >= 0 dan total > 0
  const donutEvaluation = useMemo(() => {
    if (aggregation !== 'sum') {
      return {
        isValid: false,
        reason:
          'Grafik Donut hanya aktif untuk fungsi agregasi Jumlah / Sum pada satu indikator homogen. Silakan ubah Agregasi Data di panel kiri ke "Jumlah / Sum".',
        slices: [] as Array<{
          name: string;
          value: number;
          percent: number;
        }>,
        totalValue: 0,
        truncationNote: null as string | null,
      };
    }

    if (totalGroups === 0 || allItems.length === 0) {
      return {
        isValid: false,
        reason: 'Tidak ada data kelompok untuk ditampilkan.',
        slices: [],
        totalValue: 0,
        truncationNote: null,
      };
    }

    if (totalGroups > 500) {
      return {
        isValid: false,
        reason: `Kolom "${primaryCategory}" memiliki ${formatNumberId(
          totalGroups,
          0
        )} kelompok unik (melebihi batas wajar 500 kategori untuk diagram proporsi Donut).`,
        slices: [],
        totalValue: 0,
        truncationNote: null,
      };
    }

    const hasNegative = allItems.some(
      (item) => item.nilai !== null && item.nilai < 0
    );
    if (hasNegative) {
      return {
        isValid: false,
        reason: `Kolom "${primaryNumeric}" memiliki nilai negatif pada salah satu kelompok, sehingga proporsi bagian-dari-keseluruhan (Donut) tidak valid.`,
        slices: [],
        totalValue: 0,
        truncationNote: null,
      };
    }

    const validPositiveItems = allItems.filter(
      (item) => item.nilai !== null && item.nilai > 0
    );
    const totalFromBackend =
      compareData?.total ??
      validPositiveItems.reduce((acc, it) => acc + (it.nilai || 0), 0);

    if (!totalFromBackend || totalFromBackend <= 0) {
      return {
        isValid: false,
        reason: 'Total nilai indikator bernilai 0.',
        slices: [],
        totalValue: 0,
        truncationNote: null,
      };
    }

    const top8 = validPositiveItems.slice(0, 8);
    const sumTop8 = top8.reduce((acc, it) => acc + (it.nilai || 0), 0);
    const slices = top8.map((it) => {
      const val = it.nilai || 0;
      return {
        name: String(it.label),
        value: val,
        percent: Number(((val / totalFromBackend) * 100).toFixed(2)),
      };
    });

    let note: string | null = null;
    if (validPositiveItems.length > 8) {
      const remainder = Math.max(
        0,
        Number((totalFromBackend - sumTop8).toFixed(4))
      );
      if (remainder > 0) {
        slices.push({
          name: `Lainnya (${formatNumberId(
            validPositiveItems.length - 8,
            0
          )} kelompok)`,
          value: remainder,
          percent: Number(((remainder / totalFromBackend) * 100).toFixed(2)),
        });
      }
      note = `Menampilkan 8 teratas dari ${formatNumberId(
        validPositiveItems.length,
        0
      )} kelompok (sisa digabung ke "Lainnya" karena agregasi Jumlah/Sum valid)`;
    }

    return {
      isValid: true,
      reason: '',
      slices,
      totalValue: totalFromBackend,
      truncationNote: note,
    };
  }, [aggregation, totalGroups, allItems, primaryCategory, primaryNumeric, compareData]);

  const isHorizontalBar = barItems.length > 6;

  const renderBarChart = (height: number) => (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {isHorizontalBar ? (
          <BarChart
            data={barItems}
            layout="vertical"
            margin={{ top: 8, right: 64, left: 16, bottom: 8 }}
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
              tickFormatter={(v) => formatNumberId(Number(v), 0)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={125}
              tick={{
                fill: 'var(--color-text-primary)',
                fontSize: 12,
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
                formatNumberId(typeof val === 'number' ? val : null, 2),
                primaryNumeric,
              ]}
            />
            <Bar
              dataKey="nilai"
              name={primaryNumeric}
              fill="var(--color-brand-primary)"
              radius={[0, 4, 4, 0]}
            >
              <LabelList
                dataKey="nilai"
                position="right"
                formatter={(val: unknown) =>
                  formatNumberId(typeof val === 'number' ? val : null, 0)
                }
                style={{
                  fill: 'var(--color-text-primary)',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}
              />
            </Bar>
          </BarChart>
        ) : (
          <BarChart
            data={barItems}
            margin={{ top: 24, right: 16, left: 12, bottom: 36 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: 'var(--color-text-primary)',
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <YAxis
              tick={{
                fill: 'var(--color-text-secondary)',
                fontSize: 11,
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
                formatNumberId(typeof val === 'number' ? val : null, 2),
                primaryNumeric,
              ]}
            />
            <Bar
              dataKey="nilai"
              name={primaryNumeric}
              fill="var(--color-brand-primary)"
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="nilai"
                position="top"
                formatter={(val: unknown) =>
                  formatNumberId(typeof val === 'number' ? val : null, 0)
                }
                style={{
                  fill: 'var(--color-text-primary)',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}
              />
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );

  const renderDonutChart = (height: number) => (
    <div className="space-y-4">
      {/* Ringkasan Total diletakkan di luar cincin Donut agar tidak pernah bertumpuk (Penyesuaian Wajib Butir a) */}
      <div className="p-3 rounded-button bg-header-light/70 dark:bg-header-dark/70 border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            Total {primaryNumeric} (Homogen)
          </span>
          <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
            Terdistribusi pada {formatNumberId(totalGroups, 0)} {primaryCategory}
          </span>
        </div>
        <span className="text-xl font-bold font-mono tabular-numbers text-brand-primary-light dark:text-brand-primary-dark">
          {formatNumberId(donutEvaluation.totalValue, 2)}
        </span>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutEvaluation.slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={height > 300 ? 75 : 52}
              outerRadius={height > 300 ? 125 : 86}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${
                  String(name).length > 14
                    ? `${String(name).slice(0, 12)}..`
                    : name
                } (${formatPercentId(percent)})`
              }
              labelLine={true}
            >
              {donutEvaluation.slices.map((slice, idx) => {
                const tokenStyle =
                  DONUT_TOKEN_SLICES[idx % DONUT_TOKEN_SLICES.length];
                return (
                  <Cell
                    key={slice.name}
                    fill={tokenStyle.fill}
                    fillOpacity={tokenStyle.fillOpacity}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                  />
                );
              })}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
              }}
              formatter={(val: unknown, name: string, entry: { payload?: { percent?: number } }) => [
                `${formatNumberId(
                  typeof val === 'number' ? val : null,
                  2
                )} (${formatPercentId(entry?.payload?.percent)})`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Daftar Legenda Berlabel Nilai & Persentase Langsung (Tidak Mengandalkan Warna Saja) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono">
        {donutEvaluation.slices.map((slice, idx) => {
          const tokenStyle =
            DONUT_TOKEN_SLICES[idx % DONUT_TOKEN_SLICES.length];
          return (
            <div
              key={slice.name}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-header-light/50 dark:bg-header-dark/50 border border-border-light dark:border-border-dark tabular-numbers"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-xs flex-shrink-0"
                  style={{
                    backgroundColor: tokenStyle.fill,
                    opacity: tokenStyle.fillOpacity,
                  }}
                />
                <span className="truncate text-text-primary-light dark:text-text-primary-dark">
                  {slice.name}
                </span>
              </div>
              <span className="font-semibold text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0">
                {formatPercentId(slice.percent)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCompareTable = (items: CompareCategoryItem[]) => (
    <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-button">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            <th className="py-2 px-3">{primaryCategory}</th>
            <th className="py-2 px-3 text-right">{primaryNumeric}</th>
            <th className="py-2 px-3 text-right">Porsi Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
          {items.map((it) => (
            <tr key={String(it.label)}>
              <td className="py-2 px-3 text-text-primary-light dark:text-text-primary-dark">
                {String(it.label)}
              </td>
              <td className="py-2 px-3 text-right font-semibold text-text-primary-light dark:text-text-primary-dark">
                {formatNumberId(it.nilai, 2)}
              </td>
              <td className="py-2 px-3 text-right text-text-secondary-light dark:text-text-secondary-dark">
                {formatPercentId(it.persen_dari_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* 1. KARTU BAR CHART */}
      <ChartCardShell
        title="1. Komparasi Antar-Kategori (Bar Chart)"
        subtitle={`Variabel: ${primaryNumeric} (${AGGREGATION_LABELS[aggregation]}) menurut ${primaryCategory}`}
        chartTypeSlug="komparasi_kategori_bar"
        datasetName={datasetName}
        icon={<BarChart2 className="w-5 h-5" />}
        ariaSummary={
          compareData?.deskripsi ||
          `Grafik batang perbandingan ${primaryNumeric} menurut ${primaryCategory}.`
        }
        truncationNote={barTruncationNote}
        headerControls={
          <select
            aria-label="Batas jumlah kategori yang ditampilkan pada grafik batang"
            value={barTopLimit}
            onChange={(e) => setBarTopLimit(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark min-h-control"
          >
            <option value={10}>10 Teratas</option>
            <option value={15}>15 Teratas</option>
            <option value={25}>25 Teratas</option>
            <option value={50}>Semua (Maks 50)</option>
          </select>
        }
        narrativeText={compareData?.deskripsi || null}
        isLoading={isLoading}
        isFetching={isFetching}
        errorMessage={errorMessage}
        onRetry={() => refetch()}
        onOpenFullscreen={() => setIsBarFullscreen(true)}
      >
        {renderBarChart(Math.max(260, barItems.length * 24))}
      </ChartCardShell>

      {/* 2. KARTU DONUT CHART */}
      <ChartCardShell
        title="2. Proporsi Indikator Homogen (Donut Chart)"
        subtitle={`Proporsi 1 indikator homogen: ${primaryNumeric} menurut ${primaryCategory}`}
        chartTypeSlug="proporsi_donut"
        datasetName={datasetName}
        icon={<PieChartIcon className="w-5 h-5" />}
        ariaSummary={`Diagram donat proporsi ${primaryNumeric} menurut ${primaryCategory}.`}
        truncationNote={donutEvaluation.truncationNote}
        narrativeText={
          donutEvaluation.isValid ? compareData?.deskripsi || null : null
        }
        isLoading={isLoading}
        isFetching={isFetching}
        errorMessage={errorMessage}
        onRetry={() => refetch()}
        isConditionUnmet={!donutEvaluation.isValid}
        conditionExplanation={donutEvaluation.reason}
        onOpenFullscreen={() => setIsDonutFullscreen(true)}
      >
        {renderDonutChart(240)}
      </ChartCardShell>

      {/* Modal Layar Penuh Bar Chart */}
      <FullscreenChartModal
        isOpen={isBarFullscreen}
        onClose={() => setIsBarFullscreen(false)}
        title="1. Komparasi Antar-Kategori (Bar Chart)"
        subtitle={`Variabel: ${primaryNumeric} (${AGGREGATION_LABELS[aggregation]}) menurut ${primaryCategory}`}
        chartTypeSlug="komparasi_kategori_bar"
        datasetName={datasetName}
        truncationNote={barTruncationNote}
        narrativeText={compareData?.deskripsi || null}
        dataTable={renderCompareTable(barItems)}
      >
        {renderBarChart(Math.max(420, barItems.length * 28))}
      </FullscreenChartModal>

      {/* Modal Layar Penuh Donut Chart */}
      <FullscreenChartModal
        isOpen={isDonutFullscreen}
        onClose={() => setIsDonutFullscreen(false)}
        title="2. Proporsi Indikator Homogen (Donut Chart)"
        subtitle={`Proporsi 1 indikator homogen: ${primaryNumeric} menurut ${primaryCategory}`}
        chartTypeSlug="proporsi_donut"
        datasetName={datasetName}
        truncationNote={donutEvaluation.truncationNote}
        narrativeText={compareData?.deskripsi || null}
        dataTable={renderCompareTable(allItems.slice(0, 25))}
      >
        {renderDonutChart(360)}
      </FullscreenChartModal>
    </div>
  );
};

// ============================================================================
// 3. KARTU TREN HISTORIS DERET WAKTU (LINE CHART) & 5. HEATMAP KELOMPOK × PERIODE
// ============================================================================

export interface TrendLineAndTimeHeatmapCardsProps {
  datasetId: string;
  datasetName?: string | null;
  cleanVersion: number | null;
  primaryNumeric: string;
  secondaryNumeric: string | null;
  primaryCategory: string | null;
  timeColumn: string;
  categoryUniqueCount?: number;
  aggregation: AggregationFunction;
}

export const TrendLineAndTimeHeatmapCards: React.FC<
  TrendLineAndTimeHeatmapCardsProps
> = ({
  datasetId,
  datasetName,
  cleanVersion,
  primaryNumeric,
  secondaryNumeric,
  primaryCategory,
  timeColumn,
  categoryUniqueCount,
  aggregation,
}) => {
  const [lineMode, setLineMode] = useState<'indicators' | 'groups'>(
    'indicators'
  );
  const [periodRangeFilter, setPeriodRangeFilter] = useState<'all' | 'last5'>(
    'all'
  );
  const [isLineFullscreen, setIsLineFullscreen] = useState(false);
  const [isHeatmapFullscreen, setIsHeatmapFullscreen] = useState(false);

  // Apakah group_by kategori aman dikirim ke /eda/trend (backend membatasi maks 30 kelompok)
  const canUseGroupBy =
    Boolean(primaryCategory) &&
    primaryCategory !== timeColumn &&
    (categoryUniqueCount === undefined || categoryUniqueCount <= 30);

  // Query Tren Indikator Utama (dan group_by jika canUseGroupBy aktif)
  const {
    data: primaryTrendData,
    isLoading: isPrimaryLoading,
    isFetching: isPrimaryFetching,
    error: primaryError,
    refetch: refetchPrimary,
  } = useQuery({
    queryKey: [
      'dataset-eda-trend',
      datasetId,
      cleanVersion,
      primaryNumeric,
      timeColumn,
      aggregation,
      canUseGroupBy ? primaryCategory : null,
    ],
    queryFn: ({ signal }) =>
      getEdaTrend(
        datasetId,
        {
          nilai: primaryNumeric,
          waktu: timeColumn,
          agg: aggregation,
          group_by: canUseGroupBy ? primaryCategory : null,
        },
        signal
      ),
    enabled: Boolean(datasetId) && Boolean(primaryNumeric) && Boolean(timeColumn),
    placeholderData: keepPreviousData,
  });

  // Query Tren Indikator Sekunder (hanya dimuat jika secondaryNumeric dipilih dan mode 'indicators')
  const shouldFetchSecondary =
    Boolean(datasetId) &&
    Boolean(secondaryNumeric) &&
    Boolean(timeColumn) &&
    lineMode === 'indicators';

  const {
    data: secondaryTrendData,
    isLoading: isSecondaryLoading,
    isFetching: isSecondaryFetching,
  } = useQuery({
    queryKey: [
      'dataset-eda-trend-secondary',
      datasetId,
      cleanVersion,
      secondaryNumeric,
      timeColumn,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getEdaTrend(
        datasetId,
        {
          nilai: secondaryNumeric!,
          waktu: timeColumn,
          agg: aggregation,
        },
        signal
      ),
    enabled: shouldFetchSecondary,
    placeholderData: keepPreviousData,
  });

  const primaryErrorMessage = primaryError
    ? (primaryError as Error & { localizedMessage?: string })
        ?.localizedMessage || 'Gagal memuat tren deret waktu.'
    : null;

  // Hitung CAGR ketat (Penyesuaian Wajib Butir c) pada titik yang tampil
  const rawTotalPoints = primaryTrendData?.total?.titik || [];
  const displayedTotalPoints = useMemo(() => {
    if (periodRangeFilter === 'last5' && rawTotalPoints.length > 5) {
      return rawTotalPoints.slice(-5);
    }
    return rawTotalPoints;
  }, [rawTotalPoints, periodRangeFilter]);

  const strictCagr = useMemo(
    () => computeStrictAnnualCagr(displayedTotalPoints),
    [displayedTotalPoints]
  );

  // Gabungkan data untuk Line Chart Mode 1: Indikator Utama (dan Sekunder bila ada)
  // Penyesuaian Wajib Butir d: Jika 2 kolom ditampilkan bersamaan, gunakan sumbu Y sekunder
  // berlabel jelas (`yAxisId="left"` dan `yAxisId="right"`) agar skala berbeda tidak disatukan di satu sumbu Y.
  const dualIndicatorPoints = useMemo(() => {
    const secMap = new Map<string, number | null>();
    if (secondaryTrendData?.total?.titik) {
      for (const pt of secondaryTrendData.total.titik) {
        secMap.set(String(pt.periode), pt.nilai);
      }
    }
    return displayedTotalPoints.map((pt) => ({
      periode: String(pt.periode),
      [primaryNumeric]: pt.nilai,
      pertumbuhan_utama: pt.pertumbuhan_persen,
      ...(secondaryNumeric
        ? { [secondaryNumeric]: secMap.get(String(pt.periode)) ?? null }
        : {}),
    }));
  }, [
    displayedTotalPoints,
    secondaryTrendData,
    primaryNumeric,
    secondaryNumeric,
  ]);

  // Mode 2: Pemecahan menurut kelompok (maksimal 5 seri garis sesuai Penyesuaian Wajib Butir e)
  const groupSeriesInfo = useMemo(() => {
    const perKelompok = primaryTrendData?.per_kelompok;
    if (!perKelompok) {
      return {
        top5Names: [] as string[],
        totalGroupCount: 0,
        mergedPoints: [] as Array<Record<string, string | number | null>>,
        truncationNote: null as string | null,
      };
    }

    const entries = Object.entries(perKelompok).map(([grpName, series]) => {
      const sumVal = series.titik.reduce(
        (acc, pt) => acc + (pt.nilai || 0),
        0
      );
      return { grpName, series, sumVal };
    });

    entries.sort((a, b) => b.sumVal - a.sumVal);
    const top5 = entries.slice(0, 5);
    const top5Names = top5.map((e) => e.grpName);

    const periodList = displayedTotalPoints.map((p) => String(p.periode));
    const mergedPoints = periodList.map((per) => {
      const row: Record<string, string | number | null> = { periode: per };
      for (const item of top5) {
        const found = item.series.titik.find(
          (pt) => String(pt.periode) === per
        );
        row[item.grpName] = found?.nilai ?? null;
      }
      return row;
    });

    const truncationNote =
      entries.length > 5
        ? `Menampilkan 5 teratas dari ${formatNumberId(
            entries.length,
            0
          )} kelompok (batas maksimal 5 seri garis agar tetap kontras dengan 3 token warna)`
        : null;

    return {
      top5Names,
      totalGroupCount: entries.length,
      mergedPoints,
      truncationNote,
    };
  }, [primaryTrendData, displayedTotalPoints]);

  // Data untuk Kartu #5: Heatmap Kelompok × Periode (Time Series Heatmap - Penyesuaian Wajib Butir e & f)
  const timeHeatmapMatrix = useMemo(() => {
    const periods = displayedTotalPoints.map((p) => String(p.periode));
    const perKelompok = primaryTrendData?.per_kelompok;

    const rows: Array<{
      rowLabel: string;
      values: Array<number | null>;
      sumVal: number;
    }> = [];

    if (perKelompok && Object.keys(perKelompok).length > 0) {
      for (const [grpName, series] of Object.entries(perKelompok)) {
        const valMap = new Map<string, number | null>();
        for (const pt of series.titik) {
          valMap.set(String(pt.periode), pt.nilai);
        }
        const values = periods.map((p) =>
          valMap.has(p) ? valMap.get(p) ?? null : null
        );
        const sumVal = values.reduce<number>(
          (acc, v) => acc + (v !== null ? v : 0),
          0
        );
        rows.push({ rowLabel: grpName, values, sumVal });
      }
      rows.sort((a, b) => b.sumVal - a.sumVal);
    } else if (displayedTotalPoints.length > 0) {
      // Jika tidak ada kolom kategori (atau kategori > 30), tampilkan baris indikator utama (& sekunder bila ada)
      rows.push({
        rowLabel: primaryNumeric,
        values: displayedTotalPoints.map((p) => p.nilai),
        sumVal: 0,
      });
    }

    const MAX_HEATMAP_ROWS = 15;
    const displayedRows = rows.slice(0, MAX_HEATMAP_ROWS);
    let minVal: number | null = null;
    let maxVal: number | null = null;

    for (const r of displayedRows) {
      for (const v of r.values) {
        if (v !== null && !Number.isNaN(v)) {
          if (minVal === null || v < minVal) minVal = v;
          if (maxVal === null || v > maxVal) maxVal = v;
        }
      }
    }

    const truncationNote =
      rows.length > MAX_HEATMAP_ROWS
        ? `Menampilkan ${formatNumberId(
            MAX_HEATMAP_ROWS,
            0
          )} teratas dari ${formatNumberId(rows.length, 0)} kelompok`
        : null;

    return {
      periods,
      displayedRows,
      totalRowCount: rows.length,
      minVal,
      maxVal,
      truncationNote,
    };
  }, [displayedTotalPoints, primaryTrendData, primaryNumeric]);

  const renderLineChart = (height: number) => {
    const isGroupMode =
      lineMode === 'groups' && groupSeriesInfo.top5Names.length > 0;
    const hasDualIndicators =
      !isGroupMode &&
      Boolean(secondaryNumeric) &&
      Boolean(secondaryTrendData);

    return (
      <div className="space-y-3">
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={
                isGroupMode ? groupSeriesInfo.mergedPoints : dualIndicatorPoints
              }
              margin={{ top: 16, right: hasDualIndicators ? 28 : 24, left: 12, bottom: 16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="periode"
                tick={{
                  fill: 'var(--color-text-secondary)',
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              {/* Sumbu Y Kiri (Indikator Utama) dengan judul sumbu jelas */}
              <YAxis
                yAxisId="left"
                tick={{
                  fill: 'var(--color-brand-primary)',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                tickFormatter={(v) => formatNumberId(Number(v), 0)}
                label={{
                  value: primaryNumeric,
                  angle: -90,
                  position: 'insideLeft',
                  style: {
                    fill: 'var(--color-brand-primary)',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                  },
                }}
              />
              {/* Sumbu Y Kanan Sekunder (Penyesuaian Wajib Butir d) */}
              {hasDualIndicators && secondaryNumeric && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{
                    fill: 'var(--color-brand-cyan)',
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  tickFormatter={(v) => formatNumberId(Number(v), 0)}
                  label={{
                    value: secondaryNumeric,
                    angle: 90,
                    position: 'insideRight',
                    style: {
                      fill: 'var(--color-brand-cyan)',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                    },
                  }}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text-primary)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                }}
                formatter={(val: unknown, name: string) => [
                  formatNumberId(typeof val === 'number' ? val : null, 2),
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />

              {isGroupMode ? (
                groupSeriesInfo.top5Names.map((grpName, idx) => {
                  const style =
                    LINE_SERIES_STYLES[idx % LINE_SERIES_STYLES.length];
                  return (
                    <Line
                      key={grpName}
                      yAxisId="left"
                      type="monotone"
                      dataKey={grpName}
                      name={grpName}
                      stroke={style.stroke}
                      strokeWidth={2.5}
                      strokeDasharray={style.strokeDasharray}
                      dot={{ r: 3.5, fill: style.stroke }}
                      activeDot={{ r: 5 }}
                    />
                  );
                })
              ) : (
                <>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey={primaryNumeric}
                    name={`${primaryNumeric} (Sumbu Kiri)`}
                    stroke="var(--color-brand-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--color-brand-primary)' }}
                    activeDot={{ r: 6 }}
                  />
                  {hasDualIndicators && secondaryNumeric && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey={secondaryNumeric}
                      name={`${secondaryNumeric} (Sumbu Kanan)`}
                      stroke="var(--color-brand-cyan)"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 4, fill: 'var(--color-brand-cyan)' }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Baris Ringkasan Arah Tren & Badge CAGR Ketat (Penyesuaian Wajib Butir c) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-light dark:border-border-dark text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full font-mono bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark">
              Arah Tren ({primaryNumeric}):{' '}
              <strong className="uppercase text-text-primary-light dark:text-text-primary-dark">
                {primaryTrendData?.total?.arah || '-'}
              </strong>
            </span>
            {primaryTrendData?.total?.slope_per_periode !== null &&
              primaryTrendData?.total?.slope_per_periode !== undefined && (
                <span className="px-2.5 py-1 rounded-full font-mono bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                  Slope/Periode:{' '}
                  <strong>
                    {primaryTrendData.total.slope_per_periode > 0 ? '+' : ''}
                    {formatNumberId(
                      primaryTrendData.total.slope_per_periode,
                      2
                    )}
                  </strong>
                </span>
              )}
          </div>

          {strictCagr && (
            <span
              title={`Rumus CAGR = (Nilai ${strictCagr.endYear} / Nilai ${
                strictCagr.startYear
              })^(1 / (${strictCagr.endYear} - ${
                strictCagr.startYear
              })) - 1 = (${formatNumberId(
                strictCagr.endVal,
                2
              )} / ${formatNumberId(strictCagr.startVal, 2)})^(1/${
                strictCagr.yearDiff
              }) - 1`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark tabular-numbers cursor-help"
            >
              <span>
                CAGR {strictCagr.startYear} sampai {strictCagr.endYear}:{' '}
                {strictCagr.cagrPercent > 0 ? '+' : ''}
                {formatPercentId(strictCagr.cagrPercent)}
              </span>
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render SVG untuk Kartu #5: Heatmap Kelompok × Periode (Time Series Heatmap)
  const renderTimeHeatmapSvg = (cellWidth: number, cellHeight: number) => {
    const { periods, displayedRows, minVal, maxVal } = timeHeatmapMatrix;
    if (periods.length === 0 || displayedRows.length === 0) return null;

    const labelWidth = 155;
    const headerHeight = 40;
    const legendHeight = 46;
    const svgWidth = Math.max(460, labelWidth + periods.length * cellWidth + 24);
    const svgHeight =
      headerHeight + displayedRows.length * cellHeight + legendHeight;
    const valSpan =
      minVal !== null && maxVal !== null && maxVal > minVal
        ? maxVal - minVal
        : 1;

    return (
      <div className="overflow-x-auto pb-2">
        <svg
          data-export-svg="true"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`Heatmap Kelompok kali Periode untuk ${primaryNumeric}`}
          className="mx-auto"
        >
          {/* Header Kolom Periode */}
          {periods.map((per, colIdx) => {
            const cx = labelWidth + colIdx * cellWidth + cellWidth / 2;
            return (
              <text
                key={`per-${per}`}
                x={cx}
                y={headerHeight - 12}
                textAnchor="middle"
                fill="var(--color-text-secondary)"
                fontSize="12"
                fontWeight="700"
                fontFamily="'JetBrains Mono', monospace"
              >
                {per}
              </text>
            );
          })}

          {/* Baris Kelompok & Sel Nilai */}
          {displayedRows.map((row, rowIdx) => {
            const y = headerHeight + rowIdx * cellHeight;
            const shortRow =
              row.rowLabel.length > 20
                ? `${row.rowLabel.slice(0, 18)}..`
                : row.rowLabel;

            return (
              <g key={`hrow-${row.rowLabel}`}>
                <text
                  x={labelWidth - 10}
                  y={y + cellHeight / 2 + 4}
                  textAnchor="end"
                  fill="var(--color-text-primary)"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {shortRow}
                </text>

                {row.values.map((val, colIdx) => {
                  const x = labelWidth + colIdx * cellWidth;
                  const isNull = val === null || Number.isNaN(val);
                  const ratio =
                    !isNull && minVal !== null
                      ? Math.max(0, Math.min(1, (val - minVal) / valSpan))
                      : 0;

                  // Skala satu rona dari token utama (--color-brand-primary)
                  const fillToken = isNull
                    ? 'var(--color-header)'
                    : 'var(--color-brand-primary)';
                  const fillOpacity = isNull
                    ? 1
                    : Number((0.14 + ratio * 0.8).toFixed(2));

                  const textFill =
                    !isNull && fillOpacity >= 0.56
                      ? 'var(--color-surface)'
                      : 'var(--color-text-primary)';

                  return (
                    <g key={`hcell-${row.rowLabel}-${periods[colIdx]}`}>
                      <title>
                        {`${row.rowLabel} (${periods[colIdx]}): ${
                          isNull
                            ? 'Tidak ada data (null)'
                            : formatNumberId(val, 2)
                        }`}
                      </title>
                      <rect
                        x={x + 2}
                        y={y + 2}
                        width={cellWidth - 4}
                        height={cellHeight - 4}
                        rx="6"
                        fill={fillToken}
                        fillOpacity={fillOpacity}
                        stroke="var(--color-border)"
                        strokeWidth="1"
                        strokeDasharray={isNull ? '3 3' : undefined}
                      />
                      <text
                        x={x + cellWidth / 2}
                        y={y + cellHeight / 2 + 4}
                        textAnchor="middle"
                        fill={textFill}
                        fontSize="11"
                        fontWeight="600"
                        fontFamily="'JetBrains Mono', monospace"
                      >
                        {isNull ? 'null' : formatNumberId(val, 1)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Legenda Minimum sampai Maksimum & Penanda Sel Null (Penyesuaian Wajib Butir e) */}
          <g
            transform={`translate(${labelWidth}, ${
              headerHeight + displayedRows.length * cellHeight + 16
            })`}
          >
            <rect
              x="0"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-brand-primary)"
              fillOpacity="0.16"
              stroke="var(--color-border)"
            />
            <text
              x="22"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              Min: {formatNumberId(minVal, 1)}
            </text>

            <rect
              x="145"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-brand-primary)"
              fillOpacity="0.54"
            />
            <text
              x="167"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              Menengah
            </text>

            <rect
              x="250"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-brand-primary)"
              fillOpacity="0.94"
            />
            <text
              x="272"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              Maks: {formatNumberId(maxVal, 1)}
            </text>

            <rect
              x="395"
              y="0"
              width="16"
              height="14"
              rx="3"
              fill="var(--color-header)"
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <text
              x="417"
              y="11"
              fill="var(--color-text-secondary)"
              fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
            >
              null (Kosong)
            </text>
          </g>
        </svg>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* 3. KARTU TREN HISTORIS DERET WAKTU (LINE CHART) */}
      <ChartCardShell
        title="3. Tren Historis Deret Waktu (Line Chart)"
        subtitle={`Deret waktu (${timeColumn}): ${primaryNumeric}${
          secondaryNumeric && lineMode === 'indicators'
            ? ` vs ${secondaryNumeric}`
            : ''
        } (${AGGREGATION_LABELS[aggregation]})`}
        chartTypeSlug="tren_deret_waktu"
        datasetName={datasetName}
        icon={<LineChartIcon className="w-5 h-5" />}
        ariaSummary={`Grafik garis tren deret waktu untuk ${primaryNumeric} menurut ${timeColumn}. Arah tren: ${
          primaryTrendData?.total?.arah || '-'
        }.`}
        truncationNote={
          lineMode === 'groups' ? groupSeriesInfo.truncationNote : null
        }
        headerControls={
          <div className="flex flex-wrap items-center gap-1.5">
            {canUseGroupBy && (
              <div
                className="inline-flex p-0.5 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark"
                role="group"
                aria-label="Mode seri grafik garis"
              >
                <button
                  type="button"
                  onClick={() => setLineMode('indicators')}
                  className={`px-2 py-1 text-xs font-semibold rounded-button min-h-[32px] ${
                    lineMode === 'indicators'
                      ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark'
                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  Total Indikator
                </button>
                <button
                  type="button"
                  onClick={() => setLineMode('groups')}
                  className={`px-2 py-1 text-xs font-semibold rounded-button min-h-[32px] ${
                    lineMode === 'groups'
                      ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark'
                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  Per {primaryCategory}
                </button>
              </div>
            )}

            <div
              className="inline-flex p-0.5 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark"
              role="group"
              aria-label="Filter rentang periode tren"
            >
              <button
                type="button"
                onClick={() => setPeriodRangeFilter('all')}
                className={`px-2 py-1 text-xs font-semibold rounded-button min-h-[32px] ${
                  periodRangeFilter === 'all'
                    ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setPeriodRangeFilter('last5')}
                className={`px-2 py-1 text-xs font-semibold rounded-button min-h-[32px] ${
                  periodRangeFilter === 'last5'
                    ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                }`}
              >
                5 Periode Terakhir
              </button>
            </div>
          </div>
        }
        isLoading={
          isPrimaryLoading || (shouldFetchSecondary && isSecondaryLoading)
        }
        isFetching={
          isPrimaryFetching || (shouldFetchSecondary && isSecondaryFetching)
        }
        errorMessage={primaryErrorMessage}
        onRetry={() => refetchPrimary()}
        onOpenFullscreen={() => setIsLineFullscreen(true)}
      >
        {renderLineChart(280)}
      </ChartCardShell>

      {/* 5. KARTU HEATMAP KELOMPOK × PERIODE (TIME SERIES HEATMAP) - Penyesuaian Wajib Butir f */}
      <ChartCardShell
        title="5. Heatmap Kelompok × Periode (Time Series Heatmap)"
        subtitle={`Matriks ${
          canUseGroupBy && primaryCategory ? primaryCategory : 'Indikator'
        } × ${timeColumn} untuk ${primaryNumeric} (Setara tampilan Wilayah × Tahun di desain)`}
        chartTypeSlug="heatmap_kelompok_periode"
        datasetName={datasetName}
        icon={<Grid className="w-5 h-5" />}
        ariaSummary={`Heatmap matriks deret waktu antara ${
          primaryCategory || primaryNumeric
        } dan ${timeColumn} untuk nilai ${primaryNumeric}.`}
        truncationNote={timeHeatmapMatrix.truncationNote}
        isLoading={isPrimaryLoading}
        isFetching={isPrimaryFetching}
        errorMessage={primaryErrorMessage}
        onRetry={() => refetchPrimary()}
        isConditionUnmet={
          Boolean(primaryCategory) &&
          categoryUniqueCount !== undefined &&
          categoryUniqueCount > 30
        }
        conditionExplanation={`Kolom "${primaryCategory}" memiliki ${formatNumberId(
          categoryUniqueCount,
          0
        )} kelompok unik (melebihi batas 30 kelompok pada endpoint /eda/trend). Pilih kolom kategori dengan maksimal 30 nilai unik.`}
        onOpenFullscreen={() => setIsHeatmapFullscreen(true)}
      >
        {renderTimeHeatmapSvg(76, 36)}
      </ChartCardShell>

      {/* Modal Layar Penuh Line Chart */}
      <FullscreenChartModal
        isOpen={isLineFullscreen}
        onClose={() => setIsLineFullscreen(false)}
        title="3. Tren Historis Deret Waktu (Line Chart)"
        subtitle={`Deret waktu (${timeColumn}): ${primaryNumeric}`}
        chartTypeSlug="tren_deret_waktu"
        datasetName={datasetName}
        truncationNote={
          lineMode === 'groups' ? groupSeriesInfo.truncationNote : null
        }
      >
        {renderLineChart(440)}
      </FullscreenChartModal>

      {/* Modal Layar Penuh Heatmap Kelompok × Periode */}
      <FullscreenChartModal
        isOpen={isHeatmapFullscreen}
        onClose={() => setIsHeatmapFullscreen(false)}
        title="5. Heatmap Kelompok × Periode (Time Series Heatmap)"
        subtitle={`Matriks ${
          canUseGroupBy && primaryCategory ? primaryCategory : 'Indikator'
        } × ${timeColumn} untuk ${primaryNumeric}`}
        chartTypeSlug="heatmap_kelompok_periode"
        datasetName={datasetName}
        truncationNote={timeHeatmapMatrix.truncationNote}
      >
        {renderTimeHeatmapSvg(88, 42)}
      </FullscreenChartModal>
    </div>
  );
};

// ============================================================================
// 6. KARTU BUBBLE / SCATTER CHART (SEBARAN AGREGAT PER KELOMPOK)
// ============================================================================

export interface GroupBubbleScatterCardProps {
  datasetId: string;
  datasetName?: string | null;
  cleanVersion: number | null;
  primaryNumeric: string;
  secondaryNumeric: string;
  tertiaryNumeric: string | null;
  primaryCategory: string;
  timeColumn: string | null;
  aggregation: AggregationFunction;
}

/**
 * Kartu 6. Scatter / Bubble Chart Agregat per Kelompok (Penyesuaian Wajib Butir b):
 * - Mengambil tiap kolom lewat GET /compare dengan `kelompok` dan `agg` yang SAMA, tanpa `top`.
 * - Menggabungkan berdasarkan `label`. Hanya kelompok yang memiliki nilai valid di SEMUA kolom
 *   yang diplot; melaporkan jumlah kelompok yang memiliki semua nilai ("N dari M kelompok memiliki semua nilai").
 * - Nilai ukuran gelembung (Z) harus >= 0; jika ada nilai < 0 pada kolom Z, kartu dinonaktifkan dengan penjelasan.
 * - Membatasi titik yang diplot maksimal 50 kelompok dengan catatan jujur, dan subjudul
 *   "Sebaran agregat per kelompok ({kelompok})".
 */
export const GroupBubbleScatterCard: React.FC<GroupBubbleScatterCardProps> = ({
  datasetId,
  datasetName,
  cleanVersion,
  primaryNumeric,
  secondaryNumeric,
  tertiaryNumeric,
  primaryCategory,
  timeColumn,
  aggregation,
}) => {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const sizeColumn = tertiaryNumeric || primaryNumeric;

  // Query Kolom X (primaryNumeric)
  const {
    data: xCompare,
    isLoading: isXLoading,
    isFetching: isXFetching,
    error: xError,
    refetch: refetchX,
  } = useQuery({
    queryKey: [
      'dataset-compare-full',
      datasetId,
      cleanVersion,
      primaryNumeric,
      primaryCategory,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getCompareCategory(
        datasetId,
        {
          nilai: primaryNumeric,
          kelompok: primaryCategory,
          agg: aggregation,
          waktu: timeColumn,
          urut: 'desc',
        },
        signal
      ),
    enabled:
      Boolean(datasetId) && Boolean(primaryNumeric) && Boolean(primaryCategory),
    placeholderData: keepPreviousData,
  });

  // Query Kolom Y (secondaryNumeric)
  const {
    data: yCompare,
    isLoading: isYLoading,
    isFetching: isYFetching,
    error: yError,
    refetch: refetchY,
  } = useQuery({
    queryKey: [
      'dataset-compare-full',
      datasetId,
      cleanVersion,
      secondaryNumeric,
      primaryCategory,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getCompareCategory(
        datasetId,
        {
          nilai: secondaryNumeric,
          kelompok: primaryCategory,
          agg: aggregation,
          waktu: timeColumn,
          urut: 'desc',
        },
        signal
      ),
    enabled:
      Boolean(datasetId) &&
      Boolean(secondaryNumeric) &&
      Boolean(primaryCategory),
    placeholderData: keepPreviousData,
  });

  // Query Kolom Z (tertiaryNumeric, jika berbeda dari X dan Y)
  const shouldFetchZ =
    Boolean(tertiaryNumeric) &&
    tertiaryNumeric !== primaryNumeric &&
    tertiaryNumeric !== secondaryNumeric;

  const {
    data: zCompare,
    isLoading: isZLoading,
    isFetching: isZFetching,
    error: zError,
    refetch: refetchZ,
  } = useQuery({
    queryKey: [
      'dataset-compare-full',
      datasetId,
      cleanVersion,
      tertiaryNumeric,
      primaryCategory,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getCompareCategory(
        datasetId,
        {
          nilai: tertiaryNumeric!,
          kelompok: primaryCategory,
          agg: aggregation,
          waktu: timeColumn,
          urut: 'desc',
        },
        signal
      ),
    enabled:
      Boolean(datasetId) && shouldFetchZ && Boolean(primaryCategory),
    placeholderData: keepPreviousData,
  });

  const combinedError = xError || yError || (shouldFetchZ ? zError : null);
  const errorMessage = combinedError
    ? (combinedError as Error & { localizedMessage?: string })
        ?.localizedMessage || 'Gagal memuat data sebaran Bubble/Scatter.'
    : null;

  const mergedScatterData = useMemo(() => {
    if (!xCompare || !yCompare || (shouldFetchZ && !zCompare)) {
      return {
        points: [] as Array<{
          label: string;
          x: number;
          y: number;
          z: number;
        }>,
        totalUnionGroups: 0,
        completeGroupsCount: 0,
        hasNegativeZ: false,
        note: null as string | null,
      };
    }

    const xMap = new Map<string, number>();
    const yMap = new Map<string, number>();
    const zMap = new Map<string, number>();
    const allLabels = new Set<string>();

    for (const item of xCompare.data) {
      const k = String(item.label);
      allLabels.add(k);
      if (item.nilai !== null && !Number.isNaN(item.nilai)) {
        xMap.set(k, item.nilai);
      }
    }

    for (const item of yCompare.data) {
      const k = String(item.label);
      allLabels.add(k);
      if (item.nilai !== null && !Number.isNaN(item.nilai)) {
        yMap.set(k, item.nilai);
      }
    }

    const zSource = shouldFetchZ ? zCompare!.data : xCompare.data;
    for (const item of zSource) {
      const k = String(item.label);
      allLabels.add(k);
      if (item.nilai !== null && !Number.isNaN(item.nilai)) {
        zMap.set(k, item.nilai);
      }
    }

    const completePoints: Array<{
      label: string;
      x: number;
      y: number;
      z: number;
    }> = [];
    let hasNegativeZ = false;

    for (const label of allLabels) {
      if (xMap.has(label) && yMap.has(label) && zMap.has(label)) {
        const zVal = zMap.get(label)!;
        if (zVal < 0) {
          hasNegativeZ = true;
        }
        completePoints.push({
          label,
          x: xMap.get(label)!,
          y: yMap.get(label)!,
          z: zVal,
        });
      }
    }

    // Urutkan menurut ukuran gelembung z terbesar
    completePoints.sort((a, b) => b.z - a.z);

    const MAX_SCATTER_POINTS = 50;
    const plottedPoints = completePoints.slice(0, MAX_SCATTER_POINTS);
    const totalUnionGroups = allLabels.size;
    const completeGroupsCount = completePoints.length;

    const noteParts: string[] = [
      `${formatNumberId(completeGroupsCount, 0)} dari ${formatNumberId(
        totalUnionGroups,
        0
      )} kelompok memiliki semua nilai`,
    ];

    if (completeGroupsCount > MAX_SCATTER_POINTS) {
      noteParts.push(
        `Menampilkan ${formatNumberId(
          MAX_SCATTER_POINTS,
          0
        )} teratas dari ${formatNumberId(completeGroupsCount, 0)} kelompok`
      );
    }

    return {
      points: plottedPoints,
      totalUnionGroups,
      completeGroupsCount,
      hasNegativeZ,
      note: noteParts.join(' • '),
    };
  }, [xCompare, yCompare, zCompare, shouldFetchZ]);

  const subtitle = `Sebaran agregat per kelompok (${primaryCategory}) • X: ${primaryNumeric}, Y: ${secondaryNumeric}, Ukuran Z: ${sizeColumn}`;

  const renderScatterChart = (height: number) => (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, left: 16, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            type="number"
            dataKey="x"
            name={primaryNumeric}
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            tickFormatter={(v) => formatNumberId(Number(v), 0)}
            label={{
              value: `Sumbu X: ${primaryNumeric}`,
              position: 'insideBottom',
              offset: -14,
              style: {
                fill: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontFamily: "'JetBrains Mono', monospace",
              },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={secondaryNumeric}
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            tickFormatter={(v) => formatNumberId(Number(v), 0)}
            label={{
              value: `Sumbu Y: ${secondaryNumeric}`,
              angle: -90,
              position: 'insideLeft',
              style: {
                fill: 'var(--color-text-secondary)',
                fontSize: '12px',
                fontFamily: "'JetBrains Mono', monospace",
              },
            }}
          />
          <ZAxis
            type="number"
            dataKey="z"
            name={sizeColumn}
            range={[64, 420]}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
            }}
            formatter={(val: unknown, name: string) => [
              formatNumberId(typeof val === 'number' ? val : null, 2),
              name,
            ]}
            labelFormatter={(_, payload) => {
              const first = payload?.[0]?.payload as
                | { label?: string }
                | undefined;
              return first?.label
                ? `${primaryCategory}: ${first.label}`
                : primaryCategory;
            }}
          />
          <Scatter
            name={`${primaryCategory} (${AGGREGATION_LABELS[aggregation]})`}
            data={mergedScatterData.points}
            fill="var(--color-brand-violet)"
            fillOpacity={0.72}
            stroke="var(--color-brand-primary)"
            strokeWidth={1.5}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <ChartCardShell
        title="6. Scatter / Bubble Chart"
        subtitle={subtitle}
        chartTypeSlug="scatter_bubble_kelompok"
        datasetName={datasetName}
        icon={<CircleDot className="w-5 h-5" />}
        ariaSummary={`Grafik sebaran gelembung per ${primaryCategory} yang membandingkan ${primaryNumeric} pada sumbu X, ${secondaryNumeric} pada sumbu Y, dan ${sizeColumn} sebagai ukuran gelembung.`}
        truncationNote={mergedScatterData.note}
        isLoading={
          isXLoading || isYLoading || (shouldFetchZ && isZLoading)
        }
        isFetching={
          isXFetching || isYFetching || (shouldFetchZ && isZFetching)
        }
        errorMessage={errorMessage}
        onRetry={() => {
          refetchX();
          refetchY();
          if (shouldFetchZ) refetchZ();
        }}
        isConditionUnmet={
          mergedScatterData.hasNegativeZ ||
          mergedScatterData.completeGroupsCount === 0
        }
        conditionExplanation={
          mergedScatterData.hasNegativeZ
            ? `Kolom ukuran gelembung "${sizeColumn}" memiliki nilai negatif (< 0). Ukuran radius gelembung wajib bernilai >= 0.`
            : 'Tidak ada kelompok yang memiliki pasangan nilai numerik lengkap pada kolom yang dipilih.'
        }
        onOpenFullscreen={() => setIsFullscreenOpen(true)}
      >
        {renderScatterChart(310)}
      </ChartCardShell>

      <FullscreenChartModal
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        title="6. Scatter / Bubble Chart"
        subtitle={subtitle}
        chartTypeSlug="scatter_bubble_kelompok"
        datasetName={datasetName}
        truncationNote={mergedScatterData.note}
      >
        {renderScatterChart(460)}
      </FullscreenChartModal>
    </>
  );
};

// ============================================================================
// 4, 7, & 8. TIGA KARTU GALERI DI BALIK SAKLAR B-07 (BAGIAN BAWAH GALERI)
// ============================================================================

export interface B07GalleryCardsSectionProps {
  datasetId: string;
  datasetName?: string | null;
  cleanVersion: number | null;
  selectedCategories: string[];
  primaryNumeric: string | null;
  aggregation: AggregationFunction;
}

/**
 * Tiga Kartu Galeri di Balik Saklar B-07 (Penyesuaian Wajib Jawaban #2):
 * - 4. Heatmap Matriks 2D (Kategori A × Kategori B)
 * - 7. Hierarchy Bubbles (Circle Packing)
 * - 8. Hierarchy Sunburst
 *
 * Saat `B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT === false` (default):
 * Ketiga kartu diletakkan di bagian bawah galeri dalam keadaan nonaktif dengan keterangan
 * "Menunggu dukungan backend (B-07)" tanpa memanggil atau memalsukan data.
 * Jalur aktifnya disiapkan di balik saklar B-07.
 */
export const B07GalleryCardsSection: React.FC<B07GalleryCardsSectionProps> = ({
  datasetId,
  datasetName,
  cleanVersion,
  selectedCategories,
  primaryNumeric,
  aggregation,
}) => {
  const isB07Enabled =
    BACKEND_CAPABILITIES.B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT;

  const catA = selectedCategories[0] || 'kategori_1';
  const catB = selectedCategories[1] || 'kategori_2';
  const metric = primaryNumeric || 'indikator';

  // Jalur aktif B-07 (hanya berjalan jika B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT === true)
  const { data: matrix2dData, isLoading: isMatrixLoading } = useQuery({
    queryKey: [
      'dataset-b07-matrix',
      datasetId,
      cleanVersion,
      catA,
      catB,
      metric,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getMatrix2DAnalysis(
        datasetId,
        {
          baris: catA,
          kolom: catB,
          nilai: metric,
          agg: aggregation,
        },
        signal
      ),
    enabled:
      isB07Enabled &&
      selectedCategories.length >= 2 &&
      Boolean(primaryNumeric),
  });

  const { data: hierarchyData, isLoading: isHierarchyLoading } = useQuery({
    queryKey: [
      'dataset-b07-hierarchy',
      datasetId,
      cleanVersion,
      selectedCategories,
      metric,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getHierarchyAnalysis(
        datasetId,
        {
          levels: selectedCategories.slice(0, 3),
          nilai: metric,
          agg: aggregation,
        },
        signal
      ),
    enabled:
      isB07Enabled &&
      selectedCategories.length >= 1 &&
      Boolean(primaryNumeric),
  });

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
          Diagram Matriks Lintas Kategori & Hierarki Multi-Level (Saklar B-07)
        </h3>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 4. Heatmap Matriks 2D (Kategori × Kategori) */}
        <ChartCardShell
          title="4. Heatmap Matriks 2D"
          subtitle={`Matriks silang 2 dimensi (${catA} × ${catB}) untuk ${metric}`}
          chartTypeSlug="heatmap_matriks_2d"
          datasetName={datasetName}
          icon={<Layers className="w-5 h-5" />}
          ariaSummary="Kartu Heatmap Matriks 2D lintas kategori menunggu dukungan endpoint backend B-07."
          isDisabledB07={!isB07Enabled}
          b07Explanation="Menunggu dukungan backend (B-07): Endpoint agregasi matriks 2D lintas kategori (GET /datasets/{id}/analysis/matrix) belum tersedia di server."
          isLoading={isB07Enabled && isMatrixLoading}
        >
          {isB07Enabled && matrix2dData && (
            <div className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark">
              Matriks {matrix2dData.baris} × {matrix2dData.kolom} siap dirender.
            </div>
          )}
        </ChartCardShell>

        {/* 7. Hierarchy Bubbles (Circle Packing) */}
        <ChartCardShell
          title="7. Hierarchy Bubbles (Circle Packing)"
          subtitle={`Lingkaran bersarang berjenjang (${selectedCategories.join(
            ' → '
          ) || 'Hierarki'})`}
          chartTypeSlug="hierarchy_bubbles"
          datasetName={datasetName}
          icon={<Share2 className="w-5 h-5" />}
          ariaSummary="Kartu Hierarchy Bubbles menunggu dukungan endpoint backend B-07."
          isDisabledB07={!isB07Enabled}
          b07Explanation="Menunggu dukungan backend (B-07): Endpoint agregasi pohon hierarki bertingkat (GET /datasets/{id}/analysis/hierarchy) belum tersedia di server."
          isLoading={isB07Enabled && isHierarchyLoading}
        >
          {isB07Enabled && hierarchyData && (
            <div className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark">
              Hierarki Circle Packing: {hierarchyData.root.name}
            </div>
          )}
        </ChartCardShell>

        {/* 8. Hierarchy Sunburst */}
        <ChartCardShell
          title="8. Hierarchy Sunburst"
          subtitle={`Diagram cincin hierarki multi-level (${selectedCategories.join(
            ' → '
          ) || 'Hierarki'})`}
          chartTypeSlug="hierarchy_sunburst"
          datasetName={datasetName}
          icon={<Sun className="w-5 h-5" />}
          ariaSummary="Kartu Hierarchy Sunburst menunggu dukungan endpoint backend B-07."
          isDisabledB07={!isB07Enabled}
          b07Explanation="Menunggu dukungan backend (B-07): Endpoint agregasi pohon hierarki bertingkat (GET /datasets/{id}/analysis/hierarchy) belum tersedia di server."
          isLoading={isB07Enabled && isHierarchyLoading}
        >
          {isB07Enabled && hierarchyData?.root && (
            <div className="flex justify-center">
              <SunburstChart
                width={320}
                height={320}
                data={hierarchyData.root}
                dataKey="value"
                fill="var(--color-brand-primary)"
                stroke="var(--color-surface)"
              />
            </div>
          )}
        </ChartCardShell>
      </div>
    </div>
  );
};
