import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileCode,
  Info,
  Lock,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { showToast } from '@/components/common/Toast';
import { exportChartAsPng, exportChartAsSvg } from '@/utils/chartExporter';

export interface ChartCardShellProps {
  title: string;
  subtitle: string;
  chartTypeSlug: string;
  datasetName?: string | null;
  icon: React.ReactNode;
  ariaSummary: string;
  truncationNote?: string | null;
  headerControls?: React.ReactNode;
  narrativeText?: string | null;
  isLoading?: boolean;
  isFetching?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  isDisabledB07?: boolean;
  b07Explanation?: string;
  isConditionUnmet?: boolean;
  conditionExplanation?: string;
  onOpenFullscreen?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Pembungkus Standar Kartu Grafik Analitik (Fase 5: F-34)
 * - Thumbnail indikator tipe diagram, judul, dan subjudul sumber kolom.
 * - Tombol mode layar penuh (Fullscreen Inspect) dan tombol ekspor PNG & SVG sisi klien.
 * - Penanganan loading (skeleton), kosong/syarat belum terpenuhi, error lokal per kartu
 *   (satu kartu gagal tidak merusak yang lain), serta status nonaktif B-07.
 * - Aksesibilitas: ringkasan teks aksesibel (aria-label), fokus keyboard, dan kontrol minimal 38px.
 */
export const ChartCardShell: React.FC<ChartCardShellProps> = ({
  title,
  subtitle,
  chartTypeSlug,
  datasetName,
  icon,
  ariaSummary,
  truncationNote,
  headerControls,
  narrativeText,
  isLoading = false,
  isFetching = false,
  errorMessage = null,
  onRetry,
  isDisabledB07 = false,
  b07Explanation,
  isConditionUnmet = false,
  conditionExplanation,
  onOpenFullscreen,
  className = '',
  children,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const canExportOrFullscreen =
    !isLoading && !errorMessage && !isDisabledB07 && !isConditionUnmet;

  const handleExportSvg = () => {
    const ok = exportChartAsSvg({
      containerElement: chartContainerRef.current,
      datasetName,
      chartTypeSlug,
      title,
      subtitle,
    });
    if (ok) {
      showToast(`Grafik "${title}" berhasil diunduh sebagai SVG.`, 'success');
    } else {
      showToast(
        'Elemen SVG grafik belum siap untuk diekspor. Silakan coba lagi.',
        'error'
      );
    }
  };

  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      const ok = await exportChartAsPng({
        containerElement: chartContainerRef.current,
        datasetName,
        chartTypeSlug,
        title,
        subtitle,
      });
      if (ok) {
        showToast(`Grafik "${title}" berhasil diunduh sebagai PNG.`, 'success');
      } else {
        showToast(
          'Gagal merender grafik ke berkas PNG. Silakan coba lagi.',
          'error'
        );
      }
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <section
      aria-label={`${title}. ${ariaSummary}`}
      className={`rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col overflow-hidden ${className}`}
    >
      {/* Header Kartu Grafik */}
      <div className="p-4 border-b border-border-light dark:border-border-dark flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Thumbnail Indikator Tipe Diagram */}
          <div className="p-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                {title}
              </h3>
              {isFetching && !isLoading && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark">
                  <RefreshCw className="w-3 h-3 animate-spin text-brand-cyan" />
                  <span>Memperbarui...</span>
                </span>
              )}
              {isDisabledB07 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                  <Lock className="w-3 h-3" />
                  <span>Menunggu dukungan backend (B-07)</span>
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark mt-0.5 truncate">
              {subtitle}
            </p>
            {truncationNote && (
              <p className="text-xs font-medium text-brand-primary-light dark:text-brand-primary-dark mt-1 tabular-numbers">
                {truncationNote}
              </p>
            )}
          </div>
        </div>

        {/* Kontrol Aksi Kartu (Ekspor PNG, Ekspor SVG, Layar Penuh) */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {headerControls}

          {!isDisabledB07 && (
            <>
              <button
                type="button"
                onClick={handleExportPng}
                disabled={!canExportOrFullscreen || isExportingPng}
                title="Unduh grafik sebagai gambar PNG (Sisi Klien)"
                aria-label={`Unduh grafik ${title} sebagai PNG`}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark hover:text-text-primary-light dark:hover:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed min-h-control"
              >
                <Download className="w-4 h-4" />
                <span>PNG</span>
              </button>

              <button
                type="button"
                onClick={handleExportSvg}
                disabled={!canExportOrFullscreen}
                title="Unduh grafik sebagai vektor SVG (Sisi Klien)"
                aria-label={`Unduh grafik ${title} sebagai SVG`}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark hover:text-text-primary-light dark:hover:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed min-h-control"
              >
                <FileCode className="w-4 h-4" />
                <span>SVG</span>
              </button>

              {onOpenFullscreen && (
                <button
                  type="button"
                  onClick={onOpenFullscreen}
                  disabled={!canExportOrFullscreen}
                  title="Buka mode inspeksi layar penuh"
                  aria-label={`Buka mode layar penuh untuk ${title}`}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark hover:text-text-primary-light dark:hover:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed min-h-control"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span className="sr-only sm:not-sr-only">Layar Penuh</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Deskripsi Aksesibel Tersembunyi untuk Screen Reader */}
      <p className="sr-only">{ariaSummary}</p>

      {/* Isi / Kanvas Grafik */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        {isDisabledB07 ? (
          <div className="p-6 rounded-button bg-header-light/60 dark:bg-header-dark/60 border border-dashed border-border-light dark:border-border-dark text-center space-y-2 my-auto">
            <div className="w-10 h-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto text-text-muted-light dark:text-text-muted-dark">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Menunggu dukungan backend (B-07)
            </p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
              {b07Explanation ||
                'Diagram ini membutuhkan endpoint agregasi khusus di backend (usulan B-07 pada PRD Bagian 12) dan tidak dipalsukan dari data lain.'}
            </p>
          </div>
        ) : isLoading ? (
          <div
            className="space-y-3 py-6 animate-pulse"
            aria-busy="true"
            aria-label={`Memuat data ${title}`}
          >
            <div className="h-5 w-1/3 rounded bg-header-light dark:bg-header-dark" />
            <div className="h-48 w-full rounded-button bg-header-light dark:bg-header-dark" />
            <div className="h-4 w-2/3 rounded bg-header-light dark:bg-header-dark" />
          </div>
        ) : errorMessage ? (
          <div className="p-5 rounded-button bg-anomaly-danger-bg-light/50 dark:bg-anomaly-danger-bg-dark/40 border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 space-y-3 my-auto">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                  Gagal Memuat Grafik Ini
                </p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  {errorMessage}
                </p>
              </div>
            </div>
            {onRetry && (
              <div>
                <Button
                  variant="secondary"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={onRetry}
                >
                  Coba Lagi
                </Button>
              </div>
            )}
          </div>
        ) : isConditionUnmet ? (
          <div className="p-6 rounded-button bg-header-light/50 dark:bg-header-dark/50 border border-border-light dark:border-border-dark text-center space-y-2 my-auto">
            <Info className="w-6 h-6 text-brand-primary-light dark:text-brand-primary-dark mx-auto" />
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Diagram Tidak Aktif untuk Pengaturan Saat Ini
            </p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
              {conditionExplanation}
            </p>
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full">
            {children}
          </div>
        )}

        {/* Kotak Narasi Otomatis dari Backend (Dirender sebagai teks biasa apa adanya) */}
        {narrativeText &&
          !isDisabledB07 &&
          !isLoading &&
          !errorMessage &&
          !isConditionUnmet && (
            <div className="p-3.5 rounded-button bg-header-light/70 dark:bg-header-dark/70 border border-border-light dark:border-border-dark flex items-start gap-2.5">
              <Info className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5" />
              <p className="text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                <strong className="font-semibold">Narasi Data: </strong>
                <span>{narrativeText}</span>
              </p>
            </div>
          )}
      </div>
    </section>
  );
};
