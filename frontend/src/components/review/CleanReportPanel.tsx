import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileCheck2,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AnomalyGroupBy,
  AnomalySummaryResponse,
  CleanReportResponse,
} from '@/types/dataset';
import { formatNumberId, formatPercentId } from '@/utils/formatters';

interface CleanReportPanelProps {
  cleanReport?: CleanReportResponse;
  anomalySummary?: AnomalySummaryResponse;
  isSummaryLoading: boolean;
  groupBy: AnomalyGroupBy;
  dataKolom: string;
  availableColumns: string[];
  ditolakAktifCount?: number;
  ditolakSudahDibuangCount?: number;
  onGroupByChange: (newGroupBy: AnomalyGroupBy) => void;
  onDataKolomChange: (newKolom: string) => void;
  onQuickFilterFromGroup?: (groupBy: AnomalyGroupBy, value: string) => void;
}

/**
 * Panel Laporan Hasil Pembersihan (F-12) & Dashboard Ringkasan Anomali (F-13)
 * Menampilkan metrik nyata dari GET /datasets/{id}/clean-report dan GET /datasets/{id}/anomalies/summary
 * termasuk narasi Bahasa Indonesia apa adanya dari backend.
 */
export const CleanReportPanel: React.FC<CleanReportPanelProps> = ({
  cleanReport,
  anomalySummary,
  isSummaryLoading,
  groupBy,
  dataKolom,
  availableColumns,
  ditolakAktifCount,
  ditolakSudahDibuangCount,
  onGroupByChange,
  onDataKolomChange,
  onQuickFilterFromGroup,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const perStatus = anomalySummary?.per_status || {
    pending: 0,
    diterima: 0,
    ditolak: 0,
    diperbaiki: 0,
  };

  return (
    <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
      {/* Baris Header Ringkas Laporan Pembersihan & Narasi Otomatis */}
      <div className="px-5 py-3.5 bg-header-light/60 dark:bg-header-dark/60 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            <FileCheck2 className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
            <span>Laporan Pembersihan & Ringkasan Anomali</span>
          </div>

          {cleanReport && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-numbers">
              <span className="px-2.5 py-1 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark">
                Baris:{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(cleanReport.baris_awal, 0)} →{' '}
                  {formatNumberId(cleanReport.baris_akhir, 0)}
                </strong>
              </span>

              <span className="px-2.5 py-1 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark">
                Duplikat Dibuang:{' '}
                <strong className="text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(cleanReport.duplikat_dihapus, 0)}
                </strong>
              </span>

              <span className="px-2.5 py-1 rounded-full bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark font-semibold">
                Kelengkapan: {formatPercentId(cleanReport.kelengkapan_persen)}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors min-h-control"
        >
          <span>{isExpanded ? 'Sembunyikan Rincian' : 'Tampilkan Rincian'}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* Baris 1: 4 Kartu Status Anomali & Rincian Pembersihan (F-12) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {/* 1. Pending */}
            <div className="p-3.5 rounded-card bg-anomaly-warning-bg-light/50 dark:bg-anomaly-warning-bg-dark/40 border border-border-light dark:border-border-dark flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Pending (Perlu Review)</span>
                </span>
                <div className="text-xl font-bold font-mono tabular-numbers text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark mt-1">
                  {formatNumberId(perStatus.pending, 0)}
                </div>
              </div>
            </div>

            {/* 2. Diterima */}
            <div className="p-3.5 rounded-card bg-anomaly-success-bg-light/50 dark:bg-anomaly-success-bg-dark/40 border border-border-light dark:border-border-dark flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Diterima (Valid)</span>
                </span>
                <div className="text-xl font-bold font-mono tabular-numbers text-anomaly-success-text-light dark:text-anomaly-success-text-dark mt-1">
                  {formatNumberId(perStatus.diterima, 0)}
                </div>
              </div>
            </div>

            {/* 3. Ditolak (Dipisah: Ditolak Aktif vs Sudah Dibuang sesuai Penyesuaian Wajib butir c) */}
            <div className="p-3.5 rounded-card bg-anomaly-danger-bg-light/50 dark:bg-anomaly-danger-bg-dark/40 border border-border-light dark:border-border-dark flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  <span>Ditolak (Aktif / Sudah Dibuang)</span>
                </span>
                <div className="text-xl font-bold font-mono tabular-numbers text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark mt-1 flex items-baseline gap-2">
                  <span>
                    {formatNumberId(
                      ditolakAktifCount !== undefined
                        ? ditolakAktifCount
                        : perStatus.ditolak,
                      0
                    )}{' '}
                    <span className="text-xs font-normal">aktif</span>
                  </span>
                  {ditolakSudahDibuangCount !== undefined &&
                    ditolakSudahDibuangCount > 0 && (
                      <span className="text-xs font-normal text-text-secondary-light dark:text-text-secondary-dark">
                        • {formatNumberId(ditolakSudahDibuangCount, 0)} sudah
                        dibuang
                      </span>
                    )}
                </div>
              </div>
            </div>

            {/* 4. Diperbaiki */}
            <div className="p-3.5 rounded-card bg-modified-bg-light/50 dark:bg-modified-bg-dark/50 border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark border-t border-r border-b border-border-light dark:border-border-dark flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark" />
                  <span>Diperbaiki (Edit Manual)</span>
                </span>
                <div className="text-xl font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-1">
                  {formatNumberId(perStatus.diperbaiki, 0)}
                </div>
              </div>
            </div>

            {/* 5. Konversi Tipe Numerik (F-12) */}
            <div className="p-3.5 rounded-card bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark flex flex-col justify-between">
              <span className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Konversi Kolom Numerik</span>
              </span>
              <div className="text-xs font-mono text-text-primary-light dark:text-text-primary-dark mt-1 truncate" title={cleanReport?.kolom_diubah_ke_numerik?.join(', ') || 'Tidak ada'}>
                {cleanReport && cleanReport.kolom_diubah_ke_numerik.length > 0
                  ? `${cleanReport.kolom_diubah_ke_numerik.length} kolom (${cleanReport.kolom_diubah_ke_numerik.join(', ')})`
                  : 'Tidak ada konversi'}
              </div>
            </div>
          </div>

          {/* Baris 2: Narasi Otomatis & Pengelompokan Anomali (F-13) */}
          <div className="p-4 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                <BarChart3 className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
                <span>Ringkasan & Narasi Anomali</span>
              </div>

              {/* Pemilih Group By (jenis | kolom | status | data) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  Kelompokkan per:
                </span>
                <div
                  className="inline-flex p-1 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
                  role="group"
                  aria-label="Kelompokkan ringkasan anomali"
                >
                  {(
                    [
                      { id: 'jenis', label: 'Jenis' },
                      { id: 'kolom', label: 'Kolom' },
                      { id: 'status', label: 'Status' },
                      { id: 'data', label: 'Nilai Data / Wilayah' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onGroupByChange(opt.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded-button transition-colors min-h-[32px] ${
                        groupBy === opt.id
                          ? 'bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark'
                          : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Dropdown kolom jika group_by === 'data' */}
                {groupBy === 'data' && availableColumns.length > 0 && (
                  <select
                    value={dataKolom}
                    onChange={(e) => onDataKolomChange(e.target.value)}
                    aria-label="Pilih kolom data untuk pengelompokan"
                    className="px-3 py-1.5 text-xs font-mono rounded-input border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark min-h-[34px]"
                  >
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        Kolom: {col}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Narasi Bahasa Indonesia langsung dari backend */}
            <p className="text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
              {isSummaryLoading
                ? 'Memuat ringkasan anomali...'
                : anomalySummary?.deskripsi || 'Tidak ada anomali.'}
            </p>

            {/* Daftar Chip Kelompok Anomali */}
            {anomalySummary && anomalySummary.kelompok.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {anomalySummary.kelompok.slice(0, 10).map((grp) => {
                  const canFilter =
                    groupBy === 'jenis' ||
                    groupBy === 'kolom' ||
                    groupBy === 'status';

                  return (
                    <button
                      key={grp.kelompok}
                      type="button"
                      disabled={!canFilter}
                      onClick={() => {
                        if (canFilter && onQuickFilterFromGroup) {
                          onQuickFilterFromGroup(groupBy, grp.kelompok);
                        }
                      }}
                      title={
                        canFilter
                          ? `Klik untuk memfilter tabel berdasarkan ${groupBy}: ${grp.kelompok}`
                          : `${grp.kelompok}: ${grp.jumlah} anomali`
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        canFilter
                          ? 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-brand-primary-light dark:hover:border-brand-primary-dark cursor-pointer'
                          : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark cursor-default'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-brand-primary-light dark:text-brand-primary-dark" />
                      <span className="font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                        {grp.kelompok}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full font-mono font-bold tabular-numbers bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark">
                        {formatNumberId(grp.jumlah, 0)}
                      </span>
                      {grp.pending > 0 && (
                        <span className="text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark font-mono tabular-numbers">
                          ({formatNumberId(grp.pending, 0)} pending)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
