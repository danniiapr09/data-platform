import React, { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { ChartCardShell } from './ChartCardShell';
import { FullscreenChartModal } from './FullscreenChartModal';
import { AGGREGATION_LABELS } from './ColumnSelectorSidebar';
import { getComparePeriode } from '@/services/analyticsService';
import { AggregationFunction } from '@/types/analytics';
import { formatNumberId, formatPercentId } from '@/utils/formatters';

export interface PeriodComparisonCardProps {
  datasetId: string;
  datasetName?: string | null;
  cleanVersion: number | null;
  primaryNumeric: string;
  primaryCategory: string;
  timeColumn: string;
  availablePeriods: string[];
  aggregation: AggregationFunction;
}

/**
 * Kartu Studio Komparasi Pertumbuhan Dua Periode Waktu: Periode A vs Periode B (Fase 5: F-24)
 * - Memakai endpoint `GET /datasets/{id}/compare/periode`.
 * - Menampilkan dropdown pemilihan Periode A dan Periode B, batas tampilan (10, 15, 25, Semua hingga 50),
 *   grafik batang berkelompok Recharts, tabel selisih nominal & persentase, serta narasi `deskripsi` dari backend apa adanya.
 */
export const PeriodComparisonCard: React.FC<PeriodComparisonCardProps> = ({
  datasetId,
  datasetName,
  cleanVersion,
  primaryNumeric,
  primaryCategory,
  timeColumn,
  availablePeriods,
  aggregation,
}) => {
  const [periodeA, setPeriodeA] = useState<string>('');
  const [periodeB, setPeriodeB] = useState<string>('');
  const [topLimit, setTopLimit] = useState<number>(15);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  // Set default Periode A (awal) dan Periode B (akhir) saat daftar periode tersedia
  useEffect(() => {
    if (availablePeriods.length >= 2) {
      if (!periodeA || !availablePeriods.includes(periodeA)) {
        setPeriodeA(availablePeriods[0]);
      }
      if (!periodeB || !availablePeriods.includes(periodeB)) {
        setPeriodeB(availablePeriods[availablePeriods.length - 1]);
      }
    }
  }, [availablePeriods, periodeA, periodeB]);

  const canFetch =
    Boolean(datasetId) &&
    Boolean(primaryNumeric) &&
    Boolean(primaryCategory) &&
    Boolean(timeColumn) &&
    primaryCategory !== timeColumn &&
    Boolean(periodeA) &&
    Boolean(periodeB) &&
    periodeA !== periodeB;

  const {
    data: comparePeriodeData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'dataset-compare-periode',
      datasetId,
      cleanVersion,
      primaryNumeric,
      primaryCategory,
      timeColumn,
      periodeA,
      periodeB,
      aggregation,
    ],
    queryFn: ({ signal }) =>
      getComparePeriode(
        datasetId,
        {
          nilai: primaryNumeric,
          kelompok: primaryCategory,
          periode_a: periodeA,
          periode_b: periodeB,
          agg: aggregation,
          waktu: timeColumn,
        },
        signal
      ),
    enabled: canFetch,
    placeholderData: keepPreviousData,
  });

  const errorMessage = error
    ? (error as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal memuat komparasi periode.'
    : null;

  const allItems = comparePeriodeData?.data || [];
  const totalCount = allItems.length;
  const displayedItems = allItems.slice(0, topLimit);
  const truncationNote =
    totalCount > topLimit
      ? `Menampilkan ${formatNumberId(
          displayedItems.length,
          0
        )} teratas dari ${formatNumberId(totalCount, 0)} kelompok`
      : null;

  const subtitle = `Variabel: ${primaryNumeric} (${AGGREGATION_LABELS[aggregation]}) per ${primaryCategory} • ${periodeA} vs ${periodeB}`;

  const headerControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1.5 text-sm">
        <label
          htmlFor="periode-a-select"
          className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark"
        >
          Periode A:
        </label>
        <select
          id="periode-a-select"
          value={periodeA}
          onChange={(e) => setPeriodeA(e.target.value)}
          className="px-2.5 py-1.5 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark min-h-control"
        >
          {availablePeriods.map((p) => (
            <option key={`pa-${p}`} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="inline-flex items-center gap-1.5 text-sm">
        <label
          htmlFor="periode-b-select"
          className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark"
        >
          Periode B:
        </label>
        <select
          id="periode-b-select"
          value={periodeB}
          onChange={(e) => setPeriodeB(e.target.value)}
          className="px-2.5 py-1.5 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark min-h-control"
        >
          {availablePeriods.map((p) => (
            <option key={`pb-${p}`} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="inline-flex items-center gap-1.5 text-sm">
        <label
          htmlFor="periode-top-select"
          className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark"
        >
          Batas:
        </label>
        <select
          id="periode-top-select"
          value={topLimit}
          onChange={(e) => setTopLimit(Number(e.target.value))}
          className="px-2.5 py-1.5 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark min-h-control"
        >
          <option value={10}>10 Teratas</option>
          <option value={15}>15 Teratas</option>
          <option value={25}>25 Teratas</option>
          <option value={50}>Semua (Maks 50)</option>
        </select>
      </div>
    </div>
  );

  const renderChart = (height: number) => (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={displayedItems}
          margin={{ top: 16, right: 20, left: 12, bottom: 48 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            angle={-20}
            textAnchor="end"
            interval={0}
            height={56}
          />
          <YAxis
            tick={{
              fill: 'var(--color-text-secondary)',
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
            }}
            tickFormatter={(val) => formatNumberId(Number(val), 0)}
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
            formatter={(value: unknown, name: string) => [
              formatNumberId(typeof value === 'number' ? value : null, 2),
              name,
            ]}
          />
          <Legend
            wrapperStyle={{
              fontSize: '12px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          />
          <Bar
            dataKey="periode_a"
            name={`Periode ${periodeA}`}
            fill="var(--color-brand-cyan)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="periode_b"
            name={`Periode ${periodeB}`}
            fill="var(--color-brand-primary)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderDeltaTable = (maxRows: number) => (
    <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-button">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            <th className="py-2.5 px-3">{primaryCategory}</th>
            <th className="py-2.5 px-3 text-right">{periodeA}</th>
            <th className="py-2.5 px-3 text-right">{periodeB}</th>
            <th className="py-2.5 px-3 text-right">Selisih Nominal</th>
            <th className="py-2.5 px-3 text-right">Pertumbuhan (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
          {displayedItems.slice(0, maxRows).map((item) => {
            const isUp = (item.selisih ?? 0) > 0;
            const isDown = (item.selisih ?? 0) < 0;
            return (
              <tr
                key={String(item.label)}
                className="hover:bg-canvas-light dark:hover:bg-canvas-dark/40"
              >
                <td className="py-2 px-3 font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {String(item.label)}
                </td>
                <td className="py-2 px-3 text-right text-text-secondary-light dark:text-text-secondary-dark">
                  {formatNumberId(item.periode_a, 2)}
                </td>
                <td className="py-2 px-3 text-right text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(item.periode_b, 2)}
                </td>
                <td
                  className={`py-2 px-3 text-right font-semibold ${
                    isUp
                      ? 'text-anomaly-success-text-light dark:text-anomaly-success-text-dark'
                      : isDown
                      ? 'text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark'
                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  {item.selisih !== null && item.selisih > 0 ? '+' : ''}
                  {formatNumberId(item.selisih, 2)}
                </td>
                <td
                  className={`py-2 px-3 text-right font-semibold ${
                    isUp
                      ? 'text-anomaly-success-text-light dark:text-anomaly-success-text-dark'
                      : isDown
                      ? 'text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark'
                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  {item.persen !== null && item.persen > 0 ? '+' : ''}
                  {formatPercentId(item.persen)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <ChartCardShell
        title="Studio Komparasi Pertumbuhan Periode A vs Periode B (F-24)"
        subtitle={subtitle}
        chartTypeSlug="komparasi_periode"
        datasetName={datasetName}
        icon={<ArrowUpRight className="w-5 h-5" />}
        ariaSummary={
          comparePeriodeData?.deskripsi ||
          `Komparasi perubahan nilai ${primaryNumeric} per ${primaryCategory} dari periode ${periodeA} ke ${periodeB}.`
        }
        truncationNote={truncationNote}
        headerControls={headerControls}
        narrativeText={comparePeriodeData?.deskripsi || null}
        isLoading={isLoading}
        isFetching={isFetching}
        errorMessage={errorMessage}
        onRetry={() => refetch()}
        isConditionUnmet={periodeA === periodeB || availablePeriods.length < 2}
        conditionExplanation={
          availablePeriods.length < 2
            ? 'Dataset ini memiliki kurang dari 2 periode waktu unik untuk dibandingkan.'
            : 'Pilih dua periode waktu yang berbeda (Periode A dan Periode B) untuk melihat perbandingan perubahan.'
        }
        onOpenFullscreen={() => setIsFullscreenOpen(true)}
      >
        <div className="space-y-4">
          {renderChart(290)}
          {renderDeltaTable(6)}
        </div>
      </ChartCardShell>

      <FullscreenChartModal
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        title="Studio Komparasi Pertumbuhan Periode A vs Periode B (F-24)"
        subtitle={subtitle}
        chartTypeSlug="komparasi_periode"
        datasetName={datasetName}
        truncationNote={truncationNote}
        narrativeText={comparePeriodeData?.deskripsi || null}
        dataTable={renderDeltaTable(50)}
      >
        {renderChart(440)}
      </FullscreenChartModal>
    </>
  );
};
