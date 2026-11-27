import React from 'react';
import {
  Award,
  BarChart3,
  CheckCircle2,
  HelpCircle,
  Info,
} from 'lucide-react';
import { ForecastEvaluationItem } from '@/types/forecast';
import { formatNumberId, formatPercentId } from '@/utils/formatters';

export interface ModelLeaderboardCardProps {
  bestModelName: string;
  evaluations: ForecastEvaluationItem[];
  methodologicalNotes: string[];
  totalPeriods?: number;
  testPeriodsCount?: number;
  isLegacyIncompleteReport?: boolean;
}

const MODEL_DESCRIPTIONS: Record<
  string,
  { title: string; subtitle: string }
> = {
  linear_trend: {
    title: 'linear_trend',
    subtitle: 'Tren Linear Ekstrapolasi (Regresi Derajat 1)',
  },
  drift: {
    title: 'drift',
    subtitle: 'Drift Method (Random Walk dengan Kemiringan Awal-Akhir)',
  },
  moving_average: {
    title: 'moving_average',
    subtitle: 'Rata-rata Bergerak (3 Periode Terakhir)',
  },
  naive: {
    title: 'naive',
    subtitle: 'Naive Baseline (Mengulang Nilai Periode Terakhir)',
  },
};

const METRIC_TOOLTIPS = {
  mae: 'MAE (Mean Absolute Error): Rata-rata selisih mutlak antara nilai aktual dan nilai prediksi pada periode data uji. Semakin kecil semakin baik.',
  mape: 'MAPE (Mean Absolute Percentage Error): Rata-rata persentase selisih mutlak terhadap nilai aktual pada periode data uji (bernilai "-" jika aktual bernilai 0).',
  rmse: 'RMSE (Root Mean Squared Error): Akar dari rata-rata kuadrat selisih eror pada periode data uji; memberi bobot lebih besar pada deviasi yang besar.',
};

/**
 * Kartu Papan Peringkat & Evaluasi Model Baseline (Fase 6: F-28)
 *
 * Mematuhi Aturan Konten & Penyesuaian Wajib:
 * - Empat model baseline dengan MAE, MAPE (%), RMSE dari backend.
 * - Urutan sesuai backend dengan keterangan eksplisit: "Diurutkan menurut MAE lalu RMSE (terkecil di atas)".
 * - Model terbaik dicari dengan mencocokkan nama `model_terbaik` pada daftar evaluasi (tidak mengandalkan indeks 0).
 * - Lencana "Model Terbaik" (ikon dan teks) dari field backend, TANPA tombol "Gunakan Model Ini".
 * - Nilai null tampil "-".
 * - Definisi metrik di tooltip pada header kolom.
 * - Catatan metodologis ditampilkan apa adanya dari backend sebagai teks biasa (bukan innerHTML),
 *   tanpa kalimat karangan tentang perencanaan kebijakan anggaran.
 */
export const ModelLeaderboardCard: React.FC<ModelLeaderboardCardProps> = ({
  bestModelName,
  evaluations,
  methodologicalNotes,
  totalPeriods,
  testPeriodsCount,
  isLegacyIncompleteReport = false,
}) => {
  return (
    <section
      aria-label="Papan Peringkat dan Evaluasi Model Baseline"
      className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-5 flex flex-col justify-between space-y-4"
    >
      <div className="space-y-4">
        {/* Header Kartu */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-light dark:border-border-dark pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                Papan Peringkat & Evaluasi Model Baseline
              </h3>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                Komparasi performa algoritma berbasis evaluasi holdout
                backtesting.{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  Diurutkan menurut MAE lalu RMSE (terkecil di atas).
                </strong>
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
            <Award className="w-3.5 h-3.5 text-brand-primary-light dark:text-brand-primary-dark" />
            <span>{formatNumberId(evaluations.length, 0)} Algoritma Teruji</span>
          </span>
        </div>

        {/* Peringatan jika laporan berasal dari data lama (lengkap === false) */}
        {isLegacyIncompleteReport && (
          <div className="p-3 rounded-button bg-anomaly-warning-bg-light/70 dark:bg-anomaly-warning-bg-dark/60 border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 text-sm text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
            Hasil peramalan ini disimpan sebelum rincian perbandingan 4 model
            dicatat penuh. Menampilkan metrik model terbaik yang tersimpan; klik{' '}
            <strong>Hitung Ulang Peramalan</strong> untuk memuat evaluasi 4
            model baseline secara lengkap.
          </div>
        )}

        {/* Tabel Peringkat 4 Model Baseline */}
        <div className="overflow-x-auto border border-border-light dark:border-border-dark rounded-button">
          <table className="w-full text-left border-collapse" aria-label="Papan Peringkat Evaluasi Model Peramalan">
            <thead>
              <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                <th scope="col" className="py-3 px-3.5">Peringkat & Model</th>
                <th scope="col" className="py-3 px-3.5 text-right">
                  <div className="inline-flex items-center justify-end gap-1 relative group">
                    <span>MAE</span>
                    <button
                      type="button"
                      aria-label={METRIC_TOOLTIPS.mae}
                      aria-describedby="tooltip-mae"
                      className="text-text-secondary-light dark:text-text-secondary-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark rounded-full"
                    >
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <span
                      id="tooltip-mae"
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full mt-1.5 z-30 w-60 p-2 rounded-popover text-left text-xs font-normal normal-case tracking-normal shadow-lg bg-text-primary-light text-surface-light dark:bg-surface-dark dark:text-text-primary-dark dark:border dark:border-brand-primary-dark opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity"
                    >
                      {METRIC_TOOLTIPS.mae}
                    </span>
                  </div>
                </th>
                <th scope="col" className="py-3 px-3.5 text-right">
                  <div className="inline-flex items-center justify-end gap-1 relative group">
                    <span>MAPE (%)</span>
                    <button
                      type="button"
                      aria-label={METRIC_TOOLTIPS.mape}
                      aria-describedby="tooltip-mape"
                      className="text-text-secondary-light dark:text-text-secondary-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark rounded-full"
                    >
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <span
                      id="tooltip-mape"
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full mt-1.5 z-30 w-60 p-2 rounded-popover text-left text-xs font-normal normal-case tracking-normal shadow-lg bg-text-primary-light text-surface-light dark:bg-surface-dark dark:text-text-primary-dark dark:border dark:border-brand-primary-dark opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity"
                    >
                      {METRIC_TOOLTIPS.mape}
                    </span>
                  </div>
                </th>
                <th scope="col" className="py-3 px-3.5 text-right">
                  <div className="inline-flex items-center justify-end gap-1 relative group">
                    <span>RMSE</span>
                    <button
                      type="button"
                      aria-label={METRIC_TOOLTIPS.rmse}
                      aria-describedby="tooltip-rmse"
                      className="text-text-secondary-light dark:text-text-secondary-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark rounded-full"
                    >
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <span
                      id="tooltip-rmse"
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full mt-1.5 z-30 w-60 p-2 rounded-popover text-left text-xs font-normal normal-case tracking-normal shadow-lg bg-text-primary-light text-surface-light dark:bg-surface-dark dark:text-text-primary-dark dark:border dark:border-brand-primary-dark opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity"
                    >
                      {METRIC_TOOLTIPS.rmse}
                    </span>
                  </div>
                </th>
                <th scope="col" className="py-3 px-3.5 text-center">Status Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
              {evaluations.map((item, idx) => {
                // Penyesuaian Wajib butir d: Cocokkan berdasarkan nama model_terbaik dari backend
                const isBestModel = item.model === bestModelName;
                const modelMeta = MODEL_DESCRIPTIONS[item.model] || {
                  title: item.model,
                  subtitle: 'Model Baseline Deret Waktu',
                };

                return (
                  <tr
                    key={item.model}
                    className={
                      isBestModel
                        ? 'bg-header-light/60 dark:bg-header-dark/50'
                        : 'hover:bg-canvas-light dark:hover:bg-canvas-dark/50'
                    }
                  >
                    {/* Kolom 1: Nomor Urut & Nama Model */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 tabular-numbers ${
                            isBestModel
                              ? 'bg-brand-primary-light text-white dark:bg-brand-primary-dark dark:text-canvas-dark'
                              : 'bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="block font-mono text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                            {modelMeta.title}
                          </span>
                          <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">
                            {modelMeta.subtitle}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kolom 2: MAE */}
                    <td className="py-3 px-3.5 text-right font-mono tabular-numbers font-semibold text-text-primary-light dark:text-text-primary-dark">
                      {item.mae !== null && item.mae !== undefined
                        ? formatNumberId(item.mae, 2)
                        : '-'}
                    </td>

                    {/* Kolom 3: MAPE (%) — Netral tanpa label penilaian */}
                    <td className="py-3 px-3.5 text-right font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                      {item.mape !== null && item.mape !== undefined
                        ? formatPercentId(item.mape)
                        : '-'}
                    </td>

                    {/* Kolom 4: RMSE */}
                    <td className="py-3 px-3.5 text-right font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                      {item.rmse !== null && item.rmse !== undefined
                        ? formatNumberId(item.rmse, 2)
                        : '-'}
                    </td>

                    {/* Kolom 5: Status Evaluasi (Tanpa tombol "Gunakan Model Ini") */}
                    <td className="py-3 px-3.5 text-center">
                      {isBestModel ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Model Terbaik</span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted-light dark:text-text-secondary-dark">
                          Kandidat Baseline
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kotak Catatan Metodologis: Menampilkan array `catatan` dari backend apa adanya sebagai teks biasa */}
      {methodologicalNotes.length > 0 && (
        <div className="p-4 rounded-button bg-header-light/70 dark:bg-header-dark/70 border border-border-light dark:border-border-dark space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary-light dark:text-text-primary-dark">
              <Info className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0" />
              <span>Catatan Metodologis (Dari Server Backend)</span>
            </div>
            {totalPeriods !== undefined && testPeriodsCount !== undefined && (
              <span className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                Total: {formatNumberId(totalPeriods, 0)} periode • Uji:{' '}
                {formatNumberId(testPeriodsCount, 0)} periode
              </span>
            )}
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
            {methodologicalNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
