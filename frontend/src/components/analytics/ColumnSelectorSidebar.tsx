import React from 'react';
import {
  ArrowLeftRight,
  Calendar,
  Columns,
  Hash,
  RotateCcw,
  Type,
} from 'lucide-react';
import {
  AggregationFunction,
  SelectableColumnInfo,
} from '@/types/analytics';

/**
 * Pola kata kunci untuk mendeteksi kolom yang kemungkinan merupakan pengenal (identifier).
 * Sesuai Penyesuaian Wajib butir g:
 * Default pilihan menghindari kolom yang namanya mengandung id, kode, no, atau nomor,
 * namun kolom tersebut tetap boleh dipilih manual dan diberi penanda "(kemungkinan pengenal)".
 */
export function isLikelyIdentifierColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
  const exactKeywords = new Set(['id', 'kode', 'no', 'nomor', 'nip', 'nik', 'npsn']);
  for (const t of tokens) {
    if (exactKeywords.has(t)) return true;
  }
  return (
    lower.endsWith('_id') ||
    lower.startsWith('id_') ||
    lower.includes('kode_') ||
    lower.includes('nomor_')
  );
}

export const AGGREGATION_LABELS: Record<AggregationFunction, string> = {
  sum: 'Jumlah / Sum',
  mean: 'Rata-rata / Mean',
  median: 'Median',
  min: 'Minimum / Min',
  max: 'Maksimum / Max',
};

export interface ColumnSelectorSidebarProps {
  columns: SelectableColumnInfo[];
  selectedCategories: string[];
  selectedNumerics: string[];
  selectedTimeColumn: string | null;
  detectedTimeColumn: string | null;
  manualTimeColumn: string;
  onManualTimeColumnChange: (col: string) => void;
  onToggleCategory: (col: string) => void;
  onToggleNumeric: (col: string) => void;
  onToggleTime: (col: string) => void;
  onSwapPrimarySecondaryNumeric: () => void;
  aggregation: AggregationFunction;
  onAggregationChange: (agg: AggregationFunction) => void;
  onResetDefaults: () => void;
}

/**
 * Panel Bilah Sisi Pemilih Kolom Reaktif (Fase 5: F-34 & Penyesuaian Wajib butir g):
 * - Checklist kolom dengan lencana tipe `[T]` (teks/kategori), `[123]` (angka), `[Tanggal]` (waktu).
 * - Penanda "(kemungkinan pengenal)" untuk kolom yang namanya mengandung id, kode, no, nomor.
 * - Tanpa tombol "Terapkan Variabel" (setiap perubahan centang langsung memperbarui kartu secara reaktif).
 * - Menyediakan pemilih manual kolom waktu apabila `kolom_waktu` dari backend bernilai `null`.
 */
export const ColumnSelectorSidebar: React.FC<ColumnSelectorSidebarProps> = ({
  columns,
  selectedCategories,
  selectedNumerics,
  selectedTimeColumn,
  detectedTimeColumn,
  manualTimeColumn,
  onManualTimeColumnChange,
  onToggleCategory,
  onToggleNumeric,
  onToggleTime,
  onSwapPrimarySecondaryNumeric,
  aggregation,
  onAggregationChange,
  onResetDefaults,
}) => {
  const primaryNumeric = selectedNumerics[0] || null;
  const secondaryNumeric = selectedNumerics[1] || null;
  const tertiaryNumeric = selectedNumerics[2] || null;

  const allColumnNames = columns.map((c) => c.name);

  return (
    <aside
      aria-label="Panel Pilih Kolom Analisis"
      className="w-full lg:w-[290px] flex-shrink-0 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-4 space-y-5 self-start"
    >
      {/* Header Panel */}
      <div className="flex items-start justify-between gap-2 border-b border-border-light dark:border-border-dark pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Columns className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
            <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              Pilih Kolom Analisis
            </h2>
          </div>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
            Centang variabel untuk menyaring diagram secara otomatis
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          title="Kembalikan ke pilihan kolom default"
          aria-label="Reset pilihan kolom ke default"
          className="inline-flex items-center justify-center p-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control min-w-[38px]"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Daftar Checklist Kolom */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {columns.map((col) => {
          const isTime =
            col.kind === 'time' ||
            (!detectedTimeColumn && manualTimeColumn === col.name);
          const isCategory = !isTime && col.kind === 'category';
          const isNumeric = !isTime && col.kind === 'numeric';

          const isChecked = isTime
            ? selectedTimeColumn === col.name
            : isCategory
            ? selectedCategories.includes(col.name)
            : selectedNumerics.includes(col.name);

          let roleBadge: string | null = null;
          let roleBadgePrimary = false;

          if (isTime && isChecked) {
            roleBadge = 'WAKTU';
          } else if (isCategory && isChecked) {
            roleBadge =
              selectedCategories[0] === col.name ? 'KELOMPOK' : 'KATEGORI';
          } else if (isNumeric && isChecked) {
            if (primaryNumeric === col.name) {
              roleBadge = 'UTAMA';
              roleBadgePrimary = true;
            } else if (secondaryNumeric === col.name) {
              roleBadge = 'SEKUNDER';
            } else if (tertiaryNumeric === col.name) {
              roleBadge = 'RADIUS Z';
            }
          }

          const handleToggle = () => {
            if (isTime) {
              onToggleTime(col.name);
            } else if (isCategory) {
              onToggleCategory(col.name);
            } else {
              onToggleNumeric(col.name);
            }
          };

          return (
            <label
              key={col.name}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-button border text-sm cursor-pointer transition-colors min-h-control ${
                isChecked
                  ? 'bg-header-light dark:bg-header-dark border-brand-primary-light dark:border-brand-primary-dark text-text-primary-light dark:text-text-primary-dark'
                  : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light/50 dark:hover:bg-header-dark/50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={handleToggle}
                  className="w-4 h-4 rounded accent-brand-primary-light dark:accent-brand-primary-dark flex-shrink-0"
                />

                {/* Lencana Tipe Data: [T], [123], [Tanggal] */}
                {isTime ? (
                  <span
                    title="Kolom Waktu / Tanggal"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-violet flex-shrink-0"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>[Tanggal]</span>
                  </span>
                ) : isCategory ? (
                  <span
                    title="Kolom Teks / Kategori"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-cyan flex-shrink-0"
                  >
                    <Type className="w-3 h-3" />
                    <span>[T]</span>
                  </span>
                ) : (
                  <span
                    title="Kolom Angka / Numerik"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0"
                  >
                    <Hash className="w-3 h-3" />
                    <span>[123]</span>
                  </span>
                )}

                <div className="min-w-0">
                  <span
                    className="block font-mono text-sm font-medium truncate"
                    title={col.name}
                  >
                    {col.name}
                  </span>
                  {col.isLikelyIdentifier && (
                    <span className="block text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                      (kemungkinan pengenal)
                    </span>
                  )}
                </div>
              </div>

              {roleBadge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${
                    roleBadgePrimary
                      ? 'bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark'
                      : 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
                  }`}
                >
                  {roleBadge}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Pemilih Manual Kolom Waktu bila kolom_waktu dari backend bernilai null (Butir g) */}
      {!detectedTimeColumn && (
        <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-1.5">
          <label
            htmlFor="manual-time-column-select"
            className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
          >
            Kolom Waktu Manual
          </label>
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
            Kolom waktu tidak terdeteksi otomatis. Pilih kolom waktu manual untuk
            menguji grafik tren:
          </p>
          <select
            id="manual-time-column-select"
            value={manualTimeColumn}
            onChange={(e) => onManualTimeColumnChange(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
          >
            <option value="">-- Tanpa Kolom Waktu --</option>
            {allColumnNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pemilih Agregasi Data */}
      <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-1.5">
        <label
          htmlFor="analytics-aggregation-select"
          className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
        >
          Agregasi Data
        </label>
        <select
          id="analytics-aggregation-select"
          value={aggregation}
          onChange={(e) =>
            onAggregationChange(e.target.value as AggregationFunction)
          }
          className="w-full px-3 py-2 text-sm rounded-input bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
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

      {/* Pemilih & Penukar Pasangan Rasio Indikator (Pembilang / Penyebut) */}
      <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
          Pasangan Rasio & Sekunder
        </span>
        {primaryNumeric && secondaryNumeric ? (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark">
            <div className="text-xs font-mono text-text-primary-light dark:text-text-primary-dark truncate">
              <span className="font-semibold">{primaryNumeric}</span>
              <span className="text-text-muted-light dark:text-text-muted-dark">
                {' '}
                /{' '}
              </span>
              <span>{secondaryNumeric}</span>
            </div>
            <button
              type="button"
              onClick={onSwapPrimarySecondaryNumeric}
              title="Tukar Indikator Utama (Pembilang) dan Sekunder (Penyebut)"
              aria-label="Tukar pembilang dan penyebut rasio"
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs font-semibold text-text-primary-light dark:text-text-primary-dark hover:bg-canvas-light dark:hover:bg-canvas-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control flex-shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Tukar</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
            Centang minimal 2 kolom angka [123] untuk mengaktifkan Kalkulator
            Rasio, Korelasi, dan Sebaran Bubble/Scatter.
          </p>
        )}
      </div>
    </aside>
  );
};
