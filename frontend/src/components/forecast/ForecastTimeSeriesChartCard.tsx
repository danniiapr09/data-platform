import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Flag,
  HelpCircle,
  Info,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { ChartCardShell } from '@/components/analytics/ChartCardShell';
import { FullscreenChartModal } from '@/components/analytics/FullscreenChartModal';
import { AGGREGATION_LABELS } from '@/components/analytics/ColumnSelectorSidebar';
import { AggregationFunction, EdaTrendPoint } from '@/types/analytics';
import {
  ForecastEvaluationItem,
  ForecastHoldoutPoint,
  ForecastPredictionPoint,
} from '@/types/forecast';
import {
  formatDateTimeId,
  formatNumberId,
  formatPercentId,
} from '@/utils/formatters';

export const MODEL_DISPLAY_LABELS: Record<string, string> = {
  linear_trend: 'Linear Trend (Tren Linear Ekstrapolasi)',
  drift: 'Drift Method (Random Walk dengan Drift)',
  moving_average: 'Moving Average (Rata-rata Bergerak 3-Periode)',
  naive: 'Naive Baseline (Nilai Periode Terakhir)',
};

export const MODEL_SHORT_LABELS: Record<string, string> = {
  linear_trend: 'Linear Trend',
  drift: 'Drift',
  moving_average: 'Moving Average',
  naive: 'Naive',
};

/**
 * Normalisasi kunci periode antar sumber (historis, perbandingan_uji, prediksi)
 * agar perbandingan selalu konsisten (mis. integer 2024, float 2024.0, dan string "2024" -> "2024").
 */
export function normalizePeriodKey(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    if (Number.isInteger(raw)) return String(raw);
    return String(raw);
  }
  const trimmed = String(raw).trim();
  if (/^-?\d+\.0+$/.test(trimmed)) {
    return trimmed.replace(/\.0+$/, '');
  }
  return trimmed;
}

export interface MergedForecastChartPoint {
  periodeKey: string;
  rowKind: 'historis' | 'uji' | 'proyeksi';
  rowKindLabel: 'Historis' | 'Uji' | 'Proyeksi';
  aktual: number | null;
  prediksiUji: number | null;
  proyeksi: number | null;
  bawah: number | null;
  atas: number | null;
  rentangPita: [number, number] | null;
  isBridgePoint: boolean;
}

export interface ForecastTimeSeriesChartCardProps {
  datasetName?: string | null;
  savedIndicator: string;
  savedTimeColumn: string | null;
  savedAggregation: AggregationFunction;
  savedHorizon: number;
  calculatedAtIso: string | null;
  bestModelName: string;
  totalPeriods?: number;
  testPeriodsCount?: number;
  evaluations: ForecastEvaluationItem[];
  historicalPoints: EdaTrendPoint[];
  isHistoricalLoading: boolean;
  isHistoricalFetching: boolean;
  historicalErrorMessage: string | null;
  onRetryHistorical: () => void;
  holdoutPoints: ForecastHoldoutPoint[];
  predictionPoints: ForecastPredictionPoint[];
  methodologicalNotes: string[];
}

/**
 * Penanda Kustom Bentuk Belah Ketupat (Diamond) untuk Titik Uji Validasi (Holdout).
 * Memastikan titik uji dibedakan melalui BENTUK (diamond) dan legenda, tidak mengandalkan warna saja.
 */
const HoldoutDiamondDot: React.FC<{
  cx?: number;
  cy?: number;
  value?: number | null;
}> = ({ cx, cy, value }) => {
  if (
    cx === undefined ||
    cy === undefined ||
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return null;
  }
  const size = 5.5;
  const points = `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${
    cx - size
  },${cy}`;
  return (
    <polygon
      points={points}
      fill="var(--color-brand-violet)"
      stroke="var(--color-surface)"
      strokeWidth={1.5}
    />
  );
};

/**
 * Penanda Kustom Lingkaran Berongga untuk Titik Proyeksi Masa Depan.
 */
const ProjectionHollowCircleDot: React.FC<{
  cx?: number;
  cy?: number;
  payload?: MergedForecastChartPoint;
  value?: number | null;
}> = ({ cx, cy, payload, value }) => {
  if (
    cx === undefined ||
    cy === undefined ||
    value === null ||
    value === undefined ||
    Number.isNaN(value) ||
    payload?.isBridgePoint
  ) {
    return null;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="var(--color-surface)"
      stroke="var(--color-brand-cyan)"
      strokeWidth={2.2}
    />
  );
};

/**
 * Tooltip Kustom Grafik Deret Waktu Peramalan (F-27)
 * Menampilkan Nilai Aktual, Prediksi Uji Holdout, Nilai Proyeksi, serta Batas Bawah dan Batas Atas
 * dalam format angka Indonesia dengan `tabular-nums`.
 */
const ForecastCustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: MergedForecastChartPoint }>;
  indicatorName: string;
}> = ({ active, payload, indicatorName }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  const badgeText =
    pt.rowKind === 'proyeksi'
      ? 'PROYEKSI'
      : pt.rowKind === 'uji'
      ? 'PERIODE UJI (HOLDOUT)'
      : 'HISTORIS AKTUAL';

  return (
    <div className="p-3 rounded-popover bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-lg text-xs font-mono tabular-numbers space-y-2 min-w-[230px]">
      <div className="flex items-center justify-between gap-3 border-b border-border-light dark:border-border-dark pb-1.5">
        <span className="font-bold text-text-primary-light dark:text-text-primary-dark">
          Periode: {pt.periodeKey}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark">
          {badgeText}
        </span>
      </div>

      <div className="space-y-1">
        {pt.aktual !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-text-secondary-light dark:text-text-secondary-dark">
              Aktual ({indicatorName}):
            </span>
            <span className="font-bold text-brand-primary-light dark:text-brand-primary-dark">
              {formatNumberId(pt.aktual, 2)}
            </span>
          </div>
        )}

        {pt.prediksiUji !== null && (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Prediksi Uji (Holdout):
              </span>
              <span className="font-bold text-brand-violet">
                {formatNumberId(pt.prediksiUji, 2)}
              </span>
            </div>
            {pt.aktual !== null && (
              <div className="flex items-center justify-between gap-4 text-text-muted-light dark:text-text-muted-dark">
                <span>Selisih (Aktual - Uji):</span>
                <span>{formatNumberId(pt.aktual - pt.prediksiUji, 2)}</span>
              </div>
            )}
          </>
        )}

        {pt.rowKind === 'proyeksi' && pt.proyeksi !== null && (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Proyeksi ({indicatorName}):
              </span>
              <span className="font-bold text-brand-cyan">
                {formatNumberId(pt.proyeksi, 2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Batas Bawah:
              </span>
              <span className="text-text-primary-light dark:text-text-primary-dark">
                {formatNumberId(pt.bawah, 2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-text-secondary-light dark:text-text-secondary-dark">
                Batas Atas:
              </span>
              <span className="text-text-primary-light dark:text-text-primary-dark">
                {formatNumberId(pt.atas, 2)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ForecastTimeSeriesChartCard: React.FC<
  ForecastTimeSeriesChartCardProps
> = ({
  datasetName,
  savedIndicator,
  savedTimeColumn,
  savedAggregation,
  savedHorizon,
  calculatedAtIso,
  bestModelName,
  totalPeriods,
  testPeriodsCount,
  evaluations,
  historicalPoints,
  isHistoricalLoading,
  isHistoricalFetching,
  historicalErrorMessage,
  onRetryHistorical,
  holdoutPoints,
  predictionPoints,
  methodologicalNotes,
}) => {
  const [showAllHistory, setShowAllHistory] = useState<boolean>(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState<boolean>(false);

  // Penyesuaian Wajib butir d: Cari model terbaik dengan mencocokkan nama model_terbaik pada daftar evaluasi (jangan mengandalkan indeks 0)
  const bestModelMetrics = useMemo(() => {
    if (!evaluations || evaluations.length === 0) return null;
    return (
      evaluations.find((ev) => ev.model === bestModelName) || evaluations[0]
    );
  }, [evaluations, bestModelName]);

  // Penyesuaian Wajib butir b & e:
  // Normalisasi kunci periode antar sumber (historis, uji, proyeksi).
  // Jika periode uji tidak sejajar dengan periode historis, tampilkan peringatan dan JANGAN menggabungkan dengan menebak.
  // Jika historis gagal dimuat, tampilkan grafik berisi proyeksi dan titik uji saja dengan catatan jelas.
  const mergedChartState = useMemo(() => {
    const hasHistorical =
      !historicalErrorMessage && historicalPoints && historicalPoints.length > 0;

    // Petakan holdout berdasarkan kunci periode ternormalisasi
    const holdoutByPeriod = new Map<string, ForecastHoldoutPoint>();
    for (const h of holdoutPoints) {
      const k = normalizePeriodKey(h.periode);
      if (k) holdoutByPeriod.set(k, h);
    }

    let isHoldoutAlignedWithHistory = true;
    if (hasHistorical && holdoutByPeriod.size > 0) {
      const histKeySet = new Set(
        historicalPoints.map((pt) => normalizePeriodKey(pt.periode))
      );
      for (const hKey of holdoutByPeriod.keys()) {
        if (!histKeySet.has(hKey)) {
          isHoldoutAlignedWithHistory = false;
          break;
        }
      }
    }

    const totalHistoricalCount = hasHistorical ? historicalPoints.length : 0;
    const isHistoryTruncated = totalHistoricalCount > 60 && !showAllHistory;
    const slicedHistorical =
      hasHistorical && isHistoryTruncated
        ? historicalPoints.slice(-60)
        : historicalPoints;

    const rows: MergedForecastChartPoint[] = [];

    if (hasHistorical) {
      for (const pt of slicedHistorical) {
        const key = normalizePeriodKey(pt.periode);
        const matchedHoldout = isHoldoutAlignedWithHistory
          ? holdoutByPeriod.get(key)
          : undefined;

        rows.push({
          periodeKey: key,
          rowKind: matchedHoldout ? 'uji' : 'historis',
          rowKindLabel: matchedHoldout ? 'Uji' : 'Historis',
          aktual: pt.nilai ?? matchedHoldout?.aktual ?? null,
          prediksiUji: matchedHoldout ? matchedHoldout.prediksi : null,
          proyeksi: null,
          bawah: null,
          atas: null,
          rentangPita: null,
          isBridgePoint: false,
        });
      }

      // Titik jembatan (bridge point) pada periode historis terakhir agar garis proyeksi putus-putus menyambung dari titik historis terakhir
      if (rows.length > 0 && predictionPoints.length > 0) {
        const lastHistRow = rows[rows.length - 1];
        if (lastHistRow.aktual !== null) {
          lastHistRow.proyeksi = lastHistRow.aktual;
          lastHistRow.isBridgePoint = true;
        }
      }
    } else if (holdoutPoints.length > 0) {
      // Fallback jika /eda/trend gagal dimuat: tampilkan titik uji (aktual & prediksi uji) + proyeksi
      for (const h of holdoutPoints) {
        const key = normalizePeriodKey(h.periode);
        rows.push({
          periodeKey: key,
          rowKind: 'uji',
          rowKindLabel: 'Uji',
          aktual: h.aktual ?? null,
          prediksiUji: h.prediksi ?? null,
          proyeksi: null,
          bawah: null,
          atas: null,
          rentangPita: null,
          isBridgePoint: false,
        });
      }
      if (rows.length > 0 && predictionPoints.length > 0) {
        const lastHoldoutRow = rows[rows.length - 1];
        if (lastHoldoutRow.aktual !== null) {
          lastHoldoutRow.proyeksi = lastHoldoutRow.aktual;
          lastHoldoutRow.isBridgePoint = true;
        }
      }
    }

    const transitionPeriodKey =
      rows.length > 0 ? rows[rows.length - 1].periodeKey : null;

    // Tambahkan titik-titik proyeksi masa depan
    for (const pred of predictionPoints) {
      const key = normalizePeriodKey(pred.periode);
      const hasBand =
        pred.bawah !== null &&
        pred.bawah !== undefined &&
        pred.atas !== null &&
        pred.atas !== undefined;

      rows.push({
        periodeKey: key,
        rowKind: 'proyeksi',
        rowKindLabel: 'Proyeksi',
        aktual: null,
        prediksiUji: null,
        proyeksi: pred.nilai,
        bawah: pred.bawah ?? null,
        atas: pred.atas ?? null,
        rentangPita: hasBand
          ? [Number(pred.bawah), Number(pred.atas)]
          : null,
        isBridgePoint: false,
      });
    }

    // Untuk Tabel Rincian di Mode Layar Penuh: gunakan seluruh periode tanpa pemotongan 60 titik
    const fullTableRows: MergedForecastChartPoint[] = [];
    if (hasHistorical) {
      for (const pt of historicalPoints) {
        const key = normalizePeriodKey(pt.periode);
        const matchedHoldout = isHoldoutAlignedWithHistory
          ? holdoutByPeriod.get(key)
          : undefined;
        fullTableRows.push({
          periodeKey: key,
          rowKind: matchedHoldout ? 'uji' : 'historis',
          rowKindLabel: matchedHoldout ? 'Uji' : 'Historis',
          aktual: pt.nilai ?? matchedHoldout?.aktual ?? null,
          prediksiUji: matchedHoldout ? matchedHoldout.prediksi : null,
          proyeksi: null,
          bawah: null,
          atas: null,
          rentangPita: null,
          isBridgePoint: false,
        });
      }
    } else {
      for (const h of holdoutPoints) {
        const key = normalizePeriodKey(h.periode);
        fullTableRows.push({
          periodeKey: key,
          rowKind: 'uji',
          rowKindLabel: 'Uji',
          aktual: h.aktual ?? null,
          prediksiUji: h.prediksi ?? null,
          proyeksi: null,
          bawah: null,
          atas: null,
          rentangPita: null,
          isBridgePoint: false,
        });
      }
    }
    for (const pred of predictionPoints) {
      const key = normalizePeriodKey(pred.periode);
      fullTableRows.push({
        periodeKey: key,
        rowKind: 'proyeksi',
        rowKindLabel: 'Proyeksi',
        aktual: null,
        prediksiUji: null,
        proyeksi: pred.nilai,
        bawah: pred.bawah ?? null,
        atas: pred.atas ?? null,
        rentangPita: null,
        isBridgePoint: false,
      });
    }

    return {
      rows,
      fullTableRows,
      hasHistorical,
      isHoldoutAlignedWithHistory,
      totalHistoricalCount,
      isHistoryTruncated,
      transitionPeriodKey,
    };
  }, [
    historicalErrorMessage,
    historicalPoints,
    holdoutPoints,
    predictionPoints,
    showAllHistory,
  ]);

  // Perhitungan Kartu Ringkasan Faktual (hanya angka yang bisa ditelusuri ke data)
  const summaryStats = useMemo(() => {
    const firstPred =
      predictionPoints.length > 0 ? predictionPoints[0] : null;
    const lastPred =
      predictionPoints.length > 0
        ? predictionPoints[predictionPoints.length - 1]
        : null;

    // Perubahan rata-rata per periode dihitung murni dari titik proyeksi (atau bila horizon === 1 dari titik historis terakhir ke proyeksi)
    let avgChangePerPeriod: number | null = null;
    let avgChangePercentPerPeriod: number | null = null;
    let formulaExplanation = '';

    if (
      predictionPoints.length >= 2 &&
      firstPred?.nilai !== null &&
      firstPred?.nilai !== undefined &&
      lastPred?.nilai !== null &&
      lastPred?.nilai !== undefined
    ) {
      const steps = predictionPoints.length - 1;
      avgChangePerPeriod = (lastPred.nilai - firstPred.nilai) / steps;
      if (firstPred.nilai !== 0) {
        avgChangePercentPerPeriod =
          (avgChangePerPeriod / Math.abs(firstPred.nilai)) * 100;
      }
      formulaExplanation = `Dihitung dari titik proyeksi pertama (${normalizePeriodKey(
        firstPred.periode
      )}: ${formatNumberId(
        firstPred.nilai,
        2
      )}) ke titik proyeksi akhir (${normalizePeriodKey(
        lastPred.periode
      )}: ${formatNumberId(lastPred.nilai, 2)}) dibagi ${steps} langkah periode: (Proyeksi Akhir - Proyeksi Awal) / (Horizon - 1).`;
    } else if (
      predictionPoints.length === 1 &&
      firstPred?.nilai !== null &&
      firstPred?.nilai !== undefined
    ) {
      const lastActual =
        historicalPoints.length > 0
          ? historicalPoints[historicalPoints.length - 1]?.nilai
          : holdoutPoints.length > 0
          ? holdoutPoints[holdoutPoints.length - 1]?.aktual
          : null;
      if (lastActual !== null && lastActual !== undefined) {
        avgChangePerPeriod = firstPred.nilai - lastActual;
        if (lastActual !== 0) {
          avgChangePercentPerPeriod =
            (avgChangePerPeriod / Math.abs(lastActual)) * 100;
        }
        formulaExplanation = `Selisih antara proyeksi periode ${normalizePeriodKey(
          firstPred.periode
        )} (${formatNumberId(
          firstPred.nilai,
          2
        )}) terhadap nilai aktual periode terakhir (${formatNumberId(
          lastActual,
          2
        )}).`;
      }
    }

    return {
      lastPred,
      avgChangePerPeriod,
      avgChangePercentPerPeriod,
      formulaExplanation,
    };
  }, [predictionPoints, historicalPoints, holdoutPoints]);

  const truncationNote = mergedChartState.isHistoryTruncated
    ? `Menampilkan 60 periode historis terakhir dari ${formatNumberId(
        mergedChartState.totalHistoricalCount,
        0
      )} periode (ditambah ${formatNumberId(
        predictionPoints.length,
        0
      )} periode proyeksi)`
    : null;

  const modelShortLabel =
    MODEL_SHORT_LABELS[bestModelName] || bestModelName || '-';
  const aggLabel =
    AGGREGATION_LABELS[savedAggregation] || savedAggregation || 'Jumlah / Sum';

  const ariaSummaryText = `Grafik deret waktu peramalan indikator ${savedIndicator} (${aggLabel}) menggunakan model terbaik ${modelShortLabel} untuk horizon ${savedHorizon} periode ke depan. Nilai proyeksi akhir pada periode ${normalizePeriodKey(
    summaryStats.lastPred?.periode
  )} adalah ${formatNumberId(
    summaryStats.lastPred?.nilai,
    2
  )} dengan batas bawah ${formatNumberId(
    summaryStats.lastPred?.bawah,
    2
  )} dan batas atas ${formatNumberId(summaryStats.lastPred?.atas, 2)}.`;

  // Render Grafik Utama (dipakai di Kartu maupun Modal Layar Penuh)
  const renderTimeSeriesChart = (height: number) => (
    <div className="space-y-3">
      {/* Legenda Visual Eksplisit dengan Bentuk Penanda Berbeda (Tidak Mengandalkan Warna Saja) */}
      <div
        aria-label="Legenda Grafik Deret Waktu"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark text-xs"
      >
        {/* 1. Historis Aktual: Garis Solid Biru Royal + Lingkaran Solid */}
        <div className="inline-flex items-center gap-2">
          <svg width="26" height="12" aria-hidden="true">
            <line
              x1="0"
              y1="6"
              x2="26"
              y2="6"
              stroke="var(--color-brand-primary)"
              strokeWidth="2.5"
            />
            <circle
              cx="13"
              cy="6"
              r="3.5"
              fill="var(--color-brand-primary)"
            />
          </svg>
          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
            Data Historis Aktual (Lingkaran Solid)
          </span>
        </div>

        {/* 2. Titik Uji Holdout: Garis Titik-Titik + Belah Ketupat (Diamond) */}
        <div className="inline-flex items-center gap-2">
          <svg width="26" height="14" aria-hidden="true">
            <line
              x1="0"
              y1="7"
              x2="26"
              y2="7"
              stroke="var(--color-brand-violet)"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <polygon
              points="13,2 18,7 13,12 8,7"
              fill="var(--color-brand-violet)"
            />
          </svg>
          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
            Titik Uji Evaluasi Holdout (Belah Ketupat)
          </span>
        </div>

        {/* 3. Garis Proyeksi: Garis Putus-Putus Cyan + Lingkaran Berongga */}
        <div className="inline-flex items-center gap-2">
          <svg width="26" height="12" aria-hidden="true">
            <line
              x1="0"
              y1="6"
              x2="26"
              y2="6"
              stroke="var(--color-brand-cyan)"
              strokeWidth="2.5"
              strokeDasharray="5 3"
            />
            <circle
              cx="13"
              cy="6"
              r="3.5"
              fill="var(--color-surface)"
              stroke="var(--color-brand-cyan)"
              strokeWidth="2"
            />
          </svg>
          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
            Proyeksi ({modelShortLabel}) (Garis Putus-Putus)
          </span>
        </div>

        {/* 4. Pita Rentang Prediksi */}
        <div className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="w-5 h-3 rounded-xs border border-brand-cyan/50 inline-block"
            style={{ backgroundColor: 'var(--color-forecast-ci-band)' }}
          />
          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
            Rentang Prediksi (Batas Bawah – Batas Atas)
          </span>
        </div>
      </div>

      {/* Kanvas Recharts ComposedChart */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={mergedChartState.rows}
            margin={{ top: 16, right: 24, left: 12, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="periodeKey"
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{
                fill: 'var(--color-text-primary)',
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <YAxis
              width={78}
              tick={{
                fill: 'var(--color-text-secondary)',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
              }}
              tickFormatter={(v) => formatNumberId(Number(v), 0)}
            />
            <Tooltip
              content={
                <ForecastCustomTooltip indicatorName={savedIndicator} />
              }
            />

            {/* Garis Vertikal Penanda Transisi Historis ke Proyeksi */}
            {mergedChartState.transitionPeriodKey && (
              <ReferenceLine
                x={mergedChartState.transitionPeriodKey}
                stroke="var(--color-text-muted)"
                strokeDasharray="4 4"
                label={{
                  value: 'Batas Akhir Historis',
                  position: 'insideTopLeft',
                  fill: 'var(--color-text-secondary)',
                  fontSize: 11,
                }}
              />
            )}

            {/* Area Pita Rentang Prediksi (Batas Bawah s/d Batas Atas) memakai token --color-forecast-ci-band */}
            <Area
              type="monotone"
              dataKey="rentangPita"
              name="Rentang Prediksi (Bawah – Atas)"
              fill="var(--color-forecast-ci-band)"
              stroke="var(--color-brand-cyan)"
              strokeOpacity={0.35}
              strokeWidth={1}
              connectNulls={false}
              isAnimationActive={false}
            />

            {/* Garis Historis Aktual: Solid Royal Blue */}
            <Line
              type="monotone"
              dataKey="aktual"
              name="Data Historis Aktual"
              stroke="var(--color-brand-primary)"
              strokeWidth={2.5}
              dot={{
                r: 3.5,
                fill: 'var(--color-brand-primary)',
                strokeWidth: 0,
              }}
              activeDot={{ r: 5.5 }}
              connectNulls={false}
              isAnimationActive={false}
            />

            {/* Garis & Titik Uji Evaluasi Holdout: Penanda Bentuk Belah Ketupat (Diamond) */}
            <Line
              type="monotone"
              dataKey="prediksiUji"
              name="Titik Uji Evaluasi (Holdout)"
              stroke="var(--color-brand-violet)"
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={<HoldoutDiamondDot />}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />

            {/* Garis Proyeksi Masa Depan: Putus-Putus Cyan dengan Lingkaran Berongga */}
            <Line
              type="monotone"
              dataKey="proyeksi"
              name={`Proyeksi (${modelShortLabel})`}
              stroke="var(--color-brand-cyan)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={<ProjectionHollowCircleDot />}
              activeDot={{ r: 5.5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Penyesuaian Wajib butir i:
  // Tabel Rincian per Periode untuk Mode Layar Penuh:
  // - Kolom jenis baris (Historis, Uji, Proyeksi) sebagai TEKS (tidak hanya warna)
  // - Angka rata kanan dengan tabular-nums format Indonesia
  // - Header sticky, area tabel dapat digulir
  // - Batas bawah dan batas atas tampil untuk proyeksi, dan "-" untuk nilai kosong
  const renderFullscreenPeriodTable = () => (
    <div className="max-h-[340px] overflow-y-auto overflow-x-auto border border-border-light dark:border-border-dark rounded-button">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark">
          <tr className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            <th className="py-2.5 px-3">Periode</th>
            <th className="py-2.5 px-3">Jenis Baris</th>
            <th className="py-2.5 px-3 text-right">
              Nilai Aktual ({savedIndicator})
            </th>
            <th className="py-2.5 px-3 text-right">Prediksi Uji (Holdout)</th>
            <th className="py-2.5 px-3 text-right">
              Nilai Proyeksi ({modelShortLabel})
            </th>
            <th className="py-2.5 px-3 text-right">Batas Bawah</th>
            <th className="py-2.5 px-3 text-right">Batas Atas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
          {mergedChartState.fullTableRows.map((row) => (
            <tr
              key={`${row.rowKind}-${row.periodeKey}`}
              className="hover:bg-canvas-light dark:hover:bg-canvas-dark/60"
            >
              <td className="py-2 px-3 font-semibold text-text-primary-light dark:text-text-primary-dark">
                {row.periodeKey}
              </td>
              <td className="py-2 px-3 font-sans">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    row.rowKind === 'proyeksi'
                      ? 'bg-header-light dark:bg-header-dark text-brand-cyan border border-brand-cyan/40'
                      : row.rowKind === 'uji'
                      ? 'bg-header-light dark:bg-header-dark text-brand-violet border border-brand-violet/40'
                      : 'bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark border border-border-light dark:border-border-dark'
                  }`}
                >
                  {row.rowKindLabel}
                </span>
              </td>
              <td className="py-2 px-3 text-right text-text-primary-light dark:text-text-primary-dark">
                {row.aktual !== null ? formatNumberId(row.aktual, 2) : '-'}
              </td>
              <td className="py-2 px-3 text-right text-text-primary-light dark:text-text-primary-dark">
                {row.prediksiUji !== null
                  ? formatNumberId(row.prediksiUji, 2)
                  : '-'}
              </td>
              <td className="py-2 px-3 text-right font-semibold text-text-primary-light dark:text-text-primary-dark">
                {row.rowKind === 'proyeksi' && row.proyeksi !== null
                  ? formatNumberId(row.proyeksi, 2)
                  : '-'}
              </td>
              <td className="py-2 px-3 text-right text-text-secondary-light dark:text-text-secondary-dark">
                {row.rowKind === 'proyeksi' && row.bawah !== null
                  ? formatNumberId(row.bawah, 2)
                  : '-'}
              </td>
              <td className="py-2 px-3 text-right text-text-secondary-light dark:text-text-secondary-dark">
                {row.rowKind === 'proyeksi' && row.atas !== null
                  ? formatNumberId(row.atas, 2)
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <ChartCardShell
        title="Proyeksi Deret Waktu & Rentang Prediksi (Time-Series Projection)"
        subtitle={`Indikator: ${savedIndicator} (${aggLabel}) • Sumbu Waktu: ${
          savedTimeColumn || '-'
        } • Model Terbaik: ${modelShortLabel}`}
        chartTypeSlug={`peramalan_${savedIndicator}`}
        datasetName={datasetName}
        icon={<TrendingUp className="w-5 h-5" />}
        ariaSummary={ariaSummaryText}
        truncationNote={truncationNote}
        isLoading={isHistoricalLoading && predictionPoints.length === 0}
        isFetching={isHistoricalFetching}
        headerControls={
          mergedChartState.totalHistoricalCount > 60 ? (
            <select
              aria-label="Pilihan rentang jumlah periode historis yang ditampilkan"
              value={showAllHistory ? 'all' : 'last60'}
              onChange={(e) => setShowAllHistory(e.target.value === 'all')}
              className="px-2.5 py-1.5 text-xs font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark min-h-control"
            >
              <option value="last60">60 Periode Historis Terakhir</option>
              <option value="all">
                Semua ({formatNumberId(mergedChartState.totalHistoricalCount, 0)}{' '}
                Periode)
              </option>
            </select>
          ) : undefined
        }
        onOpenFullscreen={() => setIsFullscreenOpen(true)}
      >
        <div className="space-y-4">
          {/* Baris Ringkas Parameter Hasil Tersimpan yang Sedang Ditampilkan (Penyesuaian Wajib butir b) */}
          <div className="px-3.5 py-2.5 rounded-button bg-header-light/80 dark:bg-header-dark/80 border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-secondary-light dark:text-text-secondary-dark">
              <strong className="text-text-primary-light dark:text-text-primary-dark">
                Hasil yang ditampilkan:
              </strong>
              <span>
                Indikator{' '}
                <code className="font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {savedIndicator}
                </code>
              </span>
              <span>•</span>
              <span>
                Kolom waktu{' '}
                <code className="font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {savedTimeColumn || 'terdeteksi otomatis'}
                </code>
              </span>
              <span>•</span>
              <span>
                Agregasi{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {aggLabel}
                </strong>
              </span>
              <span>•</span>
              <span className="font-mono tabular-numbers">
                Horizon{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(savedHorizon, 0)} periode
                </strong>
              </span>
              {calculatedAtIso && (
                <>
                  <span>•</span>
                  <span>
                    Dihitung pada{' '}
                    <strong className="font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                      {formatDateTimeId(calculatedAtIso)}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Peringatan bila Garis Historis (/eda/trend) Gagal Dimuat (Penyesuaian Wajib butir b) */}
          {historicalErrorMessage && (
            <div
              role="status"
              className="p-3 rounded-button bg-anomaly-warning-bg-light/70 dark:bg-anomaly-warning-bg-dark/60 border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 flex flex-wrap items-center justify-between gap-3 text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Data deret waktu historis gagal dimuat ({historicalErrorMessage}
                  ). Menampilkan titik uji evaluasi (holdout) dan garis proyeksi
                  masa depan saja.
                </span>
              </div>
              <button
                type="button"
                onClick={onRetryHistorical}
                className="underline font-semibold hover:opacity-80"
              >
                Muat Ulang Historis
              </button>
            </div>
          )}

          {/* Peringatan bila Periode Uji Tidak Sejajar dengan Historis (Penyesuaian Wajib butir b) */}
          {!mergedChartState.isHoldoutAlignedWithHistory && (
            <div
              role="status"
              className="p-3 rounded-button bg-anomaly-warning-bg-light/70 dark:bg-anomaly-warning-bg-dark/60 border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 flex items-start gap-2 text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Peringatan: Label periode pada data uji tidak sejajar dengan
                deret waktu historis saat ini. Titik uji tidak digabungkan
                secara paksa ke garis historis untuk mencegah kesalahan
                pemetaan; silakan jalankan hitung ulang peramalan.
              </span>
            </div>
          )}

          {/* Grafik Utama */}
          {renderTimeSeriesChart(350)}

          {/* 3 Kartu Ringkasan Faktual di Bawah Grafik (Hanya Angka yang Bisa Ditelusuri ke Data) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Kartu 1: Perubahan Rata-Rata Proyeksi per Periode dengan Tooltip Definisi Rumus */}
            <div className="p-4 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark flex items-start gap-3">
              <div className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                    Perubahan Rerata Proyeksi
                  </span>
                  {summaryStats.formulaExplanation && (
                    <span
                      tabIndex={0}
                      title={summaryStats.formulaExplanation}
                      aria-label={summaryStats.formulaExplanation}
                      className="inline-flex items-center text-text-muted-light dark:text-text-muted-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark cursor-help focus:outline-none focus:ring-2 focus:ring-brand-primary-light rounded-full"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-1">
                  {summaryStats.avgChangePerPeriod !== null ? (
                    <>
                      {summaryStats.avgChangePerPeriod > 0 ? '+' : ''}
                      {formatNumberId(summaryStats.avgChangePerPeriod, 2)}
                      <span className="text-xs font-normal text-text-secondary-light dark:text-text-secondary-dark">
                        {' '}
                        /periode
                      </span>
                    </>
                  ) : (
                    '-'
                  )}
                </div>
                {summaryStats.avgChangePercentPerPeriod !== null && (
                  <p className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                    ({summaryStats.avgChangePercentPerPeriod > 0 ? '+' : ''}
                    {formatPercentId(summaryStats.avgChangePercentPerPeriod)}{' '}
                    per periode terhadap titik awal proyeksi)
                  </p>
                )}
              </div>
            </div>

            {/* Kartu 2: Nilai Akhir Horizon beserta Batas Bawah dan Batas Atas (Tanpa ± Simetris) */}
            <div className="p-4 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark flex items-start gap-3">
              <div className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-cyan flex-shrink-0">
                <Flag className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                  Proyeksi Akhir Horizon (
                  {normalizePeriodKey(summaryStats.lastPred?.periode) || '-'})
                </span>
                <div className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-1">
                  {formatNumberId(summaryStats.lastPred?.nilai, 2)}
                </div>
                <p className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                  Batas Bawah:{' '}
                  <strong className="text-text-primary-light dark:text-text-primary-dark">
                    {formatNumberId(summaryStats.lastPred?.bawah, 2)}
                  </strong>{' '}
                  • Atas:{' '}
                  <strong className="text-text-primary-light dark:text-text-primary-dark">
                    {formatNumberId(summaryStats.lastPred?.atas, 2)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Kartu 3: Galat Evaluasi Data Uji Holdout (Netral Tanpa Label Penilaian "Sangat Akurat") */}
            <div className="p-4 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark flex items-start gap-3">
              <div className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                    Evaluasi Holdout ({modelShortLabel})
                  </span>
                  <span
                    tabIndex={0}
                    title="Metrik galat model terbaik yang dihitung pada periode data uji (holdout) yang tidak disertakan saat pelatihan."
                    aria-label="Metrik galat model terbaik pada data uji holdout."
                    className="inline-flex items-center text-text-muted-light dark:text-text-muted-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark cursor-help focus:outline-none focus:ring-2 focus:ring-brand-primary-light rounded-full"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-1">
                  MAPE{' '}
                  {bestModelMetrics?.mape !== null &&
                  bestModelMetrics?.mape !== undefined
                    ? formatPercentId(bestModelMetrics.mape)
                    : '-'}
                </div>
                <p className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                  MAE: {formatNumberId(bestModelMetrics?.mae, 2)} • RMSE:{' '}
                  {formatNumberId(bestModelMetrics?.rmse, 2)}
                  {testPeriodsCount !== undefined &&
                  totalPeriods !== undefined ? (
                    <span>
                      {' '}
                      ({formatNumberId(testPeriodsCount, 0)} dari{' '}
                      {formatNumberId(totalPeriods, 0)} periode)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>

          {/* Peringatan Periode Tidak Berurutan jika terdapat di Catatan Backend */}
          {methodologicalNotes.some((n) =>
            n.toLowerCase().includes('tidak berurutan')
          ) && (
            <div className="p-3 rounded-button bg-header-light/70 dark:bg-header-dark/70 border border-border-light dark:border-border-dark flex items-start gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              <Info className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5" />
              <span>
                {methodologicalNotes.find((n) =>
                  n.toLowerCase().includes('tidak berurutan')
                )}
              </span>
            </div>
          )}
        </div>
      </ChartCardShell>

      {/* Modal Inspeksi Layar Penuh dengan Tabel Rincian per Periode (Penyesuaian Wajib butir i) */}
      <FullscreenChartModal
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        title="Proyeksi Deret Waktu & Rentang Prediksi (Time-Series Projection)"
        subtitle={`Indikator: ${savedIndicator} (${aggLabel}) • Sumbu Waktu: ${
          savedTimeColumn || '-'
        } • Model Terbaik: ${modelShortLabel} • Horizon: ${savedHorizon} periode`}
        chartTypeSlug={`peramalan_${savedIndicator}`}
        datasetName={datasetName}
        truncationNote={truncationNote}
        dataTable={renderFullscreenPeriodTable()}
      >
        {renderTimeSeriesChart(430)}
      </FullscreenChartModal>
    </div>
  );
};
