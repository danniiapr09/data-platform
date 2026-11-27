import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { showToast } from '@/components/common/Toast';
import {
  downloadForecastCsvReport,
  downloadOfficialExcelReport,
} from '@/services/forecastService';
import { formatFileSizeId, formatNumberId } from '@/utils/formatters';

export interface OfficialExportCenterCardProps {
  datasetId: string;
  hasCleanData: boolean;
  hasSavedForecast: boolean;
  manualEditCount: number;
}

/**
 * CATATAN SINKRONISASI STATIS DENGAN KODE BACKEND (`backend/app/api/export.py` baris 134–145):
 * Daftar nama sheet dan deskripsi isi buku kerja Excel (.xlsx) di bawah ini diambil langsung
 * dari kode `export.py` (`export_xlsx`).
 * PENTING: Ini adalah deskripsi statis yang HARUS disinkronkan apabila struktur sheet atau
 * kolom pada `backend/app/api/export.py` mengalami perubahan di masa mendatang.
 */
interface StaticExcelSheetMeta {
  sheetName: string;
  description: string;
  conditionType: 'always' | 'when_forecast_exists' | 'when_edits_exist';
}

const BACKEND_EXCEL_SHEETS_SPEC: StaticExcelSheetMeta[] = [
  {
    sheetName: 'Ringkasan',
    description:
      'Metadata dataset, statistik pembersihan, jumlah anomali per status, dan statistik edit manual.',
    conditionType: 'always',
  },
  {
    sheetName: 'Data Bersih',
    description:
      'Tabel data bersih versi aktif (sel yang nilainya hasil edit manual diberi warna latar kuning).',
    conditionType: 'always',
  },
  {
    sheetName: 'Anomali',
    description:
      'Daftar temuan anomali (baris_di_file_asli, kolom, alasan, status).',
    conditionType: 'always',
  },
  {
    sheetName: 'Forecast',
    description:
      'Hasil proyeksi peramalan (indikator, agg, periode, nilai_prediksi, batas_bawah, batas_atas, model, mae, mape, rmse).',
    conditionType: 'when_forecast_exists',
  },
  {
    sheetName: 'Riwayat Perubahan',
    description:
      'Jejak audit edit manual sel (waktu_utc, versi, baris_di_file_asli, kolom, nilai_lama, nilai_baru, alasan, diubah_oleh).',
    conditionType: 'when_edits_exist',
  },
];

/**
 * Kartu Pusat Unduh & Ekspor Resmi (Fase 6: F-30 & F-31)
 *
 * Mematuhi Aturan Konten & Penyesuaian Wajib:
 * - Seluruh unduhan wajib melalui permintaan HTTP dengan header autentikasi (`blob`),
 *   BUKAN tautan `<a href>` langsung.
 * - Nama berkas diambil dari `Content-Disposition` (atau fallback deterministik `laporan_dataset_{id}.xlsx`
 *   dan `forecast_dataset_{id}.csv`).
 * - Tombol nonaktif dengan penjelasan aksesibel (`aria-disabled="true"`, tooltip saat hover dan fokus)
 *   bila syaratnya belum terpenuhi (Excel butuh data bersih; CSV forecast butuh hasil peramalan tersimpan).
 * - Daftar sheet Excel ditampilkan sesuai kode `export.py` dengan indikator dinamis untuk sheet kondisional
 *   (`Forecast` hanya disertakan jika sudah ada hasil peramalan; `Riwayat Perubahan` hanya jika ada edit manual).
 * - Tanpa teks karangan "untuk konsumsi REST API, pipeline ETL" dan tanpa nama berkas statis dari gambar desain.
 */
export const OfficialExportCenterCard: React.FC<
  OfficialExportCenterCardProps
> = ({ datasetId, hasCleanData, hasSavedForecast, manualEditCount }) => {
  const [isDownloadingXlsx, setIsDownloadingXlsx] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [xlsxErrorMsg, setXlsxErrorMsg] = useState<string | null>(null);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  const canDownloadXlsx = Boolean(datasetId) && hasCleanData;
  const canDownloadCsv =
    Boolean(datasetId) && hasCleanData && hasSavedForecast;

  const xlsxDisabledReason = !hasCleanData
    ? 'Unduhan Excel membutuhkan data bersih. Jalankan pembersihan otomatis di Tab 2 terlebih dahulu.'
    : null;

  const csvDisabledReason = !hasCleanData
    ? 'Unduhan CSV peramalan membutuhkan data bersih dan hasil peramalan yang sudah dihitung.'
    : !hasSavedForecast
    ? 'Belum ada hasil peramalan tersimpan untuk dataset ini. Klik "Hitung Peramalan" terlebih dahulu untuk mengaktifkan unduhan CSV.'
    : null;

  const handleDownloadXlsx = async () => {
    if (!canDownloadXlsx || isDownloadingXlsx) return;
    setXlsxErrorMsg(null);
    setIsDownloadingXlsx(true);
    try {
      const res = await downloadOfficialExcelReport(datasetId);
      showToast(
        `Buku kerja Excel "${res.filename}" (${formatFileSizeId(
          res.sizeBytes
        )}) berhasil diunduh.`,
        'success'
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mengunduh berkas laporan Excel (.xlsx).';
      setXlsxErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsDownloadingXlsx(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!canDownloadCsv || isDownloadingCsv) return;
    setCsvErrorMsg(null);
    setIsDownloadingCsv(true);
    try {
      const res = await downloadForecastCsvReport(datasetId);
      showToast(
        `Berkas CSV peramalan "${res.filename}" (${formatFileSizeId(
          res.sizeBytes
        )}) berhasil diunduh.`,
        'success'
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mengunduh berkas CSV hasil peramalan.';
      setCsvErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const hasManualEdits = manualEditCount > 0;

  return (
    <section
      aria-label="Pusat Unduh dan Ekspor Resmi"
      className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-5 flex flex-col justify-between space-y-5"
    >
      {/* Header Kartu */}
      <div className="flex items-start gap-3 border-b border-border-light dark:border-border-dark pb-4">
        <div className="p-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
            Pusat Unduh & Ekspor Resmi
          </h3>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
            Unduh buku kerja laporan Excel multi-sheet dan berkas CSV hasil
            proyeksi peramalan dari server backend.
          </p>
        </div>
      </div>

      {/* 1. Panel Unduh Buku Kerja Excel Resmi (.xlsx) — F-30 */}
      <div className="p-4 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 rounded-button bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                Laporan Lengkap Excel
              </h4>
              <p className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark truncate">
                laporan_dataset_{datasetId}.xlsx
              </p>
            </div>
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex-shrink-0">
            Multi-Sheet (.xlsx)
          </span>
        </div>

        {/* Daftar Sheet Dinamis Berdasarkan Kontrak backend/app/api/export.py */}
        <ul className="space-y-2 text-xs">
          {BACKEND_EXCEL_SHEETS_SPEC.map((sheet) => {
            const isIncluded =
              sheet.conditionType === 'always' ||
              (sheet.conditionType === 'when_forecast_exists' &&
                hasSavedForecast) ||
              (sheet.conditionType === 'when_edits_exist' && hasManualEdits);

            const conditionNote =
              sheet.conditionType === 'when_forecast_exists'
                ? hasSavedForecast
                  ? '(Disertakan: hasil peramalan tersedia)'
                  : '(Kondisional: baru disertakan setelah peramalan dihitung)'
                : sheet.conditionType === 'when_edits_exist'
                ? hasManualEdits
                  ? `(Disertakan: ${formatNumberId(
                      manualEditCount,
                      0
                    )} perubahan edit manual)`
                  : '(Kondisional: baru disertakan jika ada edit manual di Tab 2)'
                : null;

            return (
              <li
                key={sheet.sheetName}
                className={`flex items-start gap-2 ${
                  isIncluded
                    ? 'text-text-primary-light dark:text-text-primary-dark'
                    : 'text-text-muted-light dark:text-text-secondary-dark'
                }`}
              >
                {isIncluded ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex-shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-text-muted-light dark:text-text-secondary-dark flex-shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed">
                  <strong className="font-mono font-semibold">
                    Sheet &ldquo;{sheet.sheetName}&rdquo;:
                  </strong>{' '}
                  <span>{sheet.description}</span>
                  {conditionNote && (
                    <span className="block text-[11px] font-medium text-text-secondary-light dark:text-text-secondary-dark">
                      {conditionNote}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Kotak Error Unduhan Excel bila Gagal */}
        {xlsxErrorMsg && (
          <div
            role="alert"
            className="p-2.5 rounded bg-anomaly-danger-bg-light/70 dark:bg-anomaly-danger-bg-dark/60 border border-anomaly-danger-text-light/40 dark:border-anomaly-danger-text-dark/50 flex items-start gap-2 text-xs text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{xlsxErrorMsg}</span>
          </div>
        )}

        {/* Tombol Unduh Excel dengan Penjelasan Aksesibel bila Nonaktif */}
        <div className="relative group">
          <button
            type="button"
            onClick={handleDownloadXlsx}
            aria-disabled={!canDownloadXlsx || isDownloadingXlsx}
            aria-busy={isDownloadingXlsx}
            aria-describedby={
              xlsxDisabledReason ? 'xlsx-disabled-tooltip' : undefined
            }
            title={
              xlsxDisabledReason ||
              `Unduh buku kerja Excel laporan_dataset_${datasetId}.xlsx`
            }
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-button transition-colors min-h-control focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark ${
              canDownloadXlsx && !isDownloadingXlsx
                ? 'bg-brand-primary-light text-white hover:bg-brand-primary-light/90 dark:bg-brand-cyan dark:text-canvas-dark dark:hover:bg-brand-cyan/90 cursor-pointer'
                : 'bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-muted-light dark:text-text-secondary-dark opacity-70 cursor-not-allowed'
            }`}
          >
            {isDownloadingXlsx ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengunduh Laporan Excel...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh Laporan Excel (.xlsx)</span>
              </>
            )}
          </button>

          {xlsxDisabledReason && (
            <div
              id="xlsx-disabled-tooltip"
              role="tooltip"
              className="mt-1.5 p-2.5 rounded bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs text-text-secondary-light dark:text-text-secondary-dark opacity-90 group-hover:opacity-100 group-focus-within:opacity-100 group-focus-within:ring-1 group-focus-within:ring-brand-primary-light"
            >
              {xlsxDisabledReason}
            </div>
          )}
        </div>
      </div>

      {/* 2. Panel Unduh Data Proyeksi Peramalan (.csv) — F-31 */}
      <div className="p-4 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-cyan flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                Data Proyeksi Peramalan
              </h4>
              <p className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark truncate">
                forecast_dataset_{datasetId}.csv
              </p>
            </div>
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-brand-cyan/15 border border-brand-cyan/30 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0">
            CSV (UTF-8-SIG)
          </span>
        </div>

        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
          Tabel hasil proyeksi peramalan dengan encoding{' '}
          <code className="font-mono">utf-8-sig</code> (siap dibuka langsung di
          Excel) memuat kolom:{' '}
          <code className="font-mono text-text-primary-light dark:text-text-primary-dark">
            indikator, agg, periode, nilai_prediksi, batas_bawah, batas_atas,
            model, mae, mape, rmse
          </code>
          .
        </p>

        {/* Kotak Error Unduhan CSV bila Gagal */}
        {csvErrorMsg && (
          <div
            role="alert"
            className="p-2.5 rounded bg-anomaly-danger-bg-light/70 dark:bg-anomaly-danger-bg-dark/60 border border-anomaly-danger-text-light/40 dark:border-anomaly-danger-text-dark/50 flex items-start gap-2 text-xs text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{csvErrorMsg}</span>
          </div>
        )}

        {/* Tombol Unduh CSV dengan Penjelasan Aksesibel (aria-disabled & tooltip hover/focus) bila Nonaktif */}
        <div className="relative group">
          <button
            type="button"
            onClick={handleDownloadCsv}
            aria-disabled={!canDownloadCsv || isDownloadingCsv}
            aria-busy={isDownloadingCsv}
            aria-describedby={
              csvDisabledReason ? 'csv-disabled-tooltip' : undefined
            }
            title={
              csvDisabledReason ||
              `Unduh tabel hasil peramalan forecast_dataset_${datasetId}.csv`
            }
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-button transition-colors min-h-control focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark ${
              canDownloadCsv && !isDownloadingCsv
                ? 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark cursor-pointer'
                : 'bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-muted-light dark:text-text-secondary-dark opacity-70 cursor-not-allowed'
            }`}
          >
            {isDownloadingCsv ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Mengunduh CSV Forecast...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh CSV Forecast</span>
              </>
            )}
          </button>

          {csvDisabledReason && (
            <div
              id="csv-disabled-tooltip"
              role="tooltip"
              className="mt-1.5 p-2.5 rounded bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs text-text-secondary-light dark:text-text-secondary-dark opacity-90 group-hover:opacity-100 group-focus-within:opacity-100 group-focus-within:ring-1 group-focus-within:ring-brand-primary-light"
            >
              {csvDisabledReason}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
