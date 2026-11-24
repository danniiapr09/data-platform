import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  Info,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import {
  AGGREGATION_LABELS,
  isLikelyIdentifierColumn,
} from '@/components/analytics/ColumnSelectorSidebar';
import { AggregationFunction } from '@/types/analytics';
import { formatNumberId } from '@/utils/formatters';

export interface ForecastConfigFormProps {
  candidateIndicators: string[];
  detectedTimeColumn: string | null;
  allColumns: string[];
  selectedIndicator: string;
  onIndicatorChange: (col: string) => void;
  selectedTimeColumn: string;
  onTimeColumnChange: (col: string) => void;
  selectedAggregation: AggregationFunction;
  onAggregationChange: (agg: AggregationFunction) => void;
  horizon: number;
  onHorizonChange: (h: number) => void;
  testSizeInput: string;
  onTestSizeInputChange: (val: string) => void;
  hasSavedForecast: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  effectiveTestSizeNotice: {
    requested: number;
    effective: number;
    totalPeriods: number;
  } | null;
  onSubmit: () => void;
}

/**
 * Form Konfigurasi Parameter Peramalan Deret Waktu (Fase 6: F-26)
 *
 * Mematuhi Aturan Konten & Penyesuaian Wajib:
 * - Tanpa label "ENGINE: AUTO-FORECASTER V1.4".
 * - Indikator diambil dari `kandidat_indikator` (GET /eda).
 * - Kolom waktu default dari `kolom_waktu` terdeteksi, disertai pemilih manual bila `null`.
 * - Fungsi agregasi sesuai backend (`sum`, `mean`, `median`, `min`, `max`).
 * - Horizon 1 sampai 24 periode (default 3), slider dan input angka tersinkron dengan satuan "periode".
 * - `test_size` opsional dengan teks bantuan & validasi; menampilkan periode uji efektif ("diminta M, dipakai N")
 *   bila berbeda dari yang diisi (Penyesuaian Wajib butir c).
 * - Pesan error 400 backend tampil di dalam kartu (`role="alert"`), tanpa toast ganda.
 * - Satu tombol aksi utama ("Hitung Peramalan" atau "Hitung Ulang Peramalan" bila hasil sudah ada)
 *   disertai catatan "Hasil peramalan tersimpan sebelumnya akan diganti."
 */
export const ForecastConfigForm: React.FC<ForecastConfigFormProps> = ({
  candidateIndicators,
  detectedTimeColumn,
  allColumns,
  selectedIndicator,
  onIndicatorChange,
  selectedTimeColumn,
  onTimeColumnChange,
  selectedAggregation,
  onAggregationChange,
  horizon,
  onHorizonChange,
  testSizeInput,
  onTestSizeInputChange,
  hasSavedForecast,
  isSubmitting,
  errorMessage,
  effectiveTestSizeNotice,
  onSubmit,
}) => {
  const timeColumnChoices = React.useMemo(() => {
    const set = new Set<string>();
    if (detectedTimeColumn) set.add(detectedTimeColumn);
    for (const c of allColumns) set.add(c);
    return Array.from(set);
  }, [detectedTimeColumn, allColumns]);

  const parsedTestSize =
    testSizeInput.trim() === '' ? null : Number(testSizeInput.trim());
  const isTestSizeInvalid =
    parsedTestSize !== null &&
    (!Number.isInteger(parsedTestSize) || parsedTestSize < 1);

  const isFormIncomplete =
    !selectedIndicator ||
    !selectedTimeColumn ||
    horizon < 1 ||
    horizon > 24 ||
    isTestSizeInvalid;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormIncomplete || isSubmitting) return;
    onSubmit();
  };

  const handleHorizonNumberInput = (raw: string) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    const clamped = Math.max(1, Math.min(24, Math.round(num)));
    onHorizonChange(clamped);
  };

  return (
    <section
      aria-label="Konfigurasi Parameter Peramalan Deret Waktu"
      className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-5 space-y-5"
    >
      {/* Header Form Konfigurasi (Tanpa label ENGINE: AUTO-FORECASTER V1.4) */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-light dark:border-border-dark pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              Konfigurasi Parameter Peramalan Deret Waktu
            </h2>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
              Pilih indikator target numerik, kolom sumbu waktu, metode agregasi
              per periode, dan horizon prediksi (1–24 periode).
            </p>
          </div>
        </div>
      </div>

      {/* Form Input Parameter */}
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-start">
          {/* 1. Indikator Target (3 kolom grid xl) */}
          <div className="xl:col-span-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="forecast-indicator-select"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
              >
                Indikator Target
              </label>
              <span className="text-xs font-mono text-text-muted-light dark:text-text-muted-dark">
                nilai
              </span>
            </div>
            <select
              id="forecast-indicator-select"
              value={selectedIndicator}
              disabled={isSubmitting || candidateIndicators.length === 0}
              onChange={(e) => onIndicatorChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 min-h-control"
            >
              {candidateIndicators.length === 0 ? (
                <option value="">-- Tidak ada kolom numerik --</option>
              ) : (
                candidateIndicators.map((col) => {
                  const isId = isLikelyIdentifierColumn(col);
                  return (
                    <option key={col} value={col}>
                      {col}
                      {isId ? ' (kemungkinan pengenal)' : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* 2. Sumbu Waktu (2 kolom grid xl) */}
          <div className="xl:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="forecast-time-select"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
              >
                Sumbu Waktu
              </label>
              <span className="text-xs font-mono text-text-muted-light dark:text-text-muted-dark">
                waktu
              </span>
            </div>
            <select
              id="forecast-time-select"
              value={selectedTimeColumn}
              disabled={isSubmitting || timeColumnChoices.length === 0}
              onChange={(e) => onTimeColumnChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 min-h-control"
            >
              <option value="">-- Pilih Kolom Waktu --</option>
              {timeColumnChoices.map((col) => (
                <option key={col} value={col}>
                  {col}
                  {detectedTimeColumn === col ? ' (Terdeteksi)' : ''}
                </option>
              ))}
            </select>
            {!detectedTimeColumn && (
              <p className="text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                Kolom waktu tidak terdeteksi otomatis. Pilih manual kolom waktu.
              </p>
            )}
          </div>

          {/* 3. Metode Agregasi (2 kolom grid xl) */}
          <div className="xl:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="forecast-agg-select"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
              >
                Metode Agregasi
              </label>
              <span className="text-xs font-mono text-text-muted-light dark:text-text-muted-dark">
                agg
              </span>
            </div>
            <select
              id="forecast-agg-select"
              value={selectedAggregation}
              disabled={isSubmitting}
              onChange={(e) =>
                onAggregationChange(e.target.value as AggregationFunction)
              }
              className="w-full px-3 py-2 text-sm rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 min-h-control"
            >
              {(Object.keys(AGGREGATION_LABELS) as AggregationFunction[]).map(
                (aggKey) => (
                  <option key={aggKey} value={aggKey}>
                    {AGGREGATION_LABELS[aggKey]}
                  </option>
                )
              )}
            </select>
          </div>

          {/* 4. Horizon Prediksi: Slider 1–24 & Input Angka Tersinkron (3 kolom grid xl) */}
          <div className="xl:col-span-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="forecast-horizon-slider"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
              >
                Horizon Prediksi
              </label>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark tabular-numbers">
                {formatNumberId(horizon, 0)} periode
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-1.5 rounded-input bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark min-h-control">
              <input
                id="forecast-horizon-slider"
                type="range"
                min={1}
                max={24}
                step={1}
                value={horizon}
                disabled={isSubmitting}
                onChange={(e) => onHorizonChange(Number(e.target.value))}
                aria-label="Slider horizon prediksi dalam satuan periode (1 sampai 24 periode)"
                className="flex-1 accent-brand-primary-light dark:accent-brand-primary-dark cursor-pointer"
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  id="forecast-horizon-number"
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={horizon}
                  disabled={isSubmitting}
                  onChange={(e) => handleHorizonNumberInput(e.target.value)}
                  aria-label="Input angka horizon prediksi (1 sampai 24 periode)"
                  className="w-16 px-2 py-1 text-sm font-mono text-center rounded bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark tabular-numbers"
                />
                <span className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark pr-1">
                  periode
                </span>
              </div>
            </div>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
              Rentang: 1–24 periode ke depan (default: 3 periode).
            </p>
          </div>

          {/* 5. Ukuran Data Uji / Holdout Opsional (2 kolom grid xl) */}
          <div className="xl:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="forecast-test-size-input"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
              >
                Data Uji (Opsional)
              </label>
              <span className="text-xs font-mono text-text-muted-light dark:text-text-muted-dark">
                test_size
              </span>
            </div>
            <input
              id="forecast-test-size-input"
              type="number"
              min={1}
              step={1}
              placeholder="Otomatis"
              value={testSizeInput}
              disabled={isSubmitting}
              onChange={(e) => onTestSizeInputChange(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 min-h-control tabular-numbers"
            />
            {isTestSizeInvalid ? (
              <p className="text-xs text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                Data uji harus bilangan bulat minimal 1 periode.
              </p>
            ) : (
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                Kosongkan untuk otomatis (20% periode, maks. 3; sisa data latih
                min. 3 periode).
              </p>
            )}
          </div>
        </div>

        {/* Catatan Penyesuaian Periode Uji Efektif bila Berbeda dari yang Diminta (Penyesuaian Wajib butir c) */}
        {effectiveTestSizeNotice && (
          <div
            role="status"
            className="p-3 rounded-button bg-anomaly-warning-bg-light/70 dark:bg-anomaly-warning-bg-dark/60 border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 flex items-start gap-2.5 text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-semibold">
                Penyesuaian Periode Data Uji (Holdout):{' '}
              </strong>
              Diminta{' '}
              <span className="font-mono font-bold tabular-numbers">
                {formatNumberId(effectiveTestSizeNotice.requested, 0)}
              </span>{' '}
              periode, dipakai{' '}
              <span className="font-mono font-bold tabular-numbers">
                {formatNumberId(effectiveTestSizeNotice.effective, 0)}
              </span>{' '}
              periode (dari total{' '}
              <span className="font-mono font-bold tabular-numbers">
                {formatNumberId(effectiveTestSizeNotice.totalPeriods, 0)}
              </span>{' '}
              periode historis) karena server mewajibkan minimal 3 titik
              periode sebagai data latih.
            </p>
          </div>
        )}

        {/* Kotak Error 400 / Jaringan di Dalam Kartu (Tanpa Toast Ganda) */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-button bg-anomaly-danger-bg-light/70 dark:bg-anomaly-danger-bg-dark/60 border border-anomaly-danger-text-light/40 dark:border-anomaly-danger-text-dark/50 flex items-start gap-2.5"
          >
            <AlertCircle className="w-5 h-5 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                Perhitungan Peramalan Tidak Dapat Dijalankan
              </p>
              <p className="text-xs text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {/* Baris Bawah Form: Catatan Penggantian Hasil Lama & Tombol Aksi Tunggal */}
        <div className="pt-2 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <Info className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0" />
            {hasSavedForecast ? (
              <span>
                <strong>Catatan:</strong> Hasil peramalan tersimpan sebelumnya
                akan diganti.
              </span>
            ) : (
              <span>
                Minimal dibutuhkan 4 periode waktu unik pada data bersih untuk
                menjalankan evaluasi 4 model baseline.
              </span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isFormIncomplete || isSubmitting}
            icon={
              isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )
            }
          >
            {isSubmitting
              ? 'Menghitung Peramalan...'
              : hasSavedForecast
              ? 'Hitung Ulang Peramalan'
              : 'Hitung Peramalan'}
          </Button>
        </div>
      </form>
    </section>
  );
};
