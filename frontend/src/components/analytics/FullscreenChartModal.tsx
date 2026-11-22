import React, { useRef, useState } from 'react';
import { Download, FileCode, Info } from 'lucide-react';
import { AccessibleModalDialog } from '@/components/common/AccessibleModalDialog';
import { showToast } from '@/components/common/Toast';
import { exportChartAsPng, exportChartAsSvg } from '@/utils/chartExporter';

export interface FullscreenChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  chartTypeSlug: string;
  datasetName?: string | null;
  truncationNote?: string | null;
  narrativeText?: string | null;
  children: React.ReactNode;
  dataTable?: React.ReactNode;
}

/**
 * Modal Inspeksi Layar Penuh untuk Kartu Grafik Analitik (Fase 5: F-34 & Butir j).
 * Memakai komponen dialog bersama baru (`AccessibleModalDialog`) tanpa mengubah `ApplyReviewModal`.
 */
export const FullscreenChartModal: React.FC<FullscreenChartModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  chartTypeSlug,
  datasetName,
  truncationNote,
  narrativeText,
  children,
  dataTable,
}) => {
  const modalChartContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const handleExportSvg = () => {
    const ok = exportChartAsSvg({
      containerElement: modalChartContainerRef.current,
      datasetName,
      chartTypeSlug: `${chartTypeSlug}_penuh`,
      title,
      subtitle,
    });
    if (ok) {
      showToast(`Grafik "${title}" berhasil diunduh sebagai SVG.`, 'success');
    } else {
      showToast('Gagal mengekspor grafik ke berkas SVG.', 'error');
    }
  };

  const handleExportPng = async () => {
    setIsExportingPng(true);
    try {
      const ok = await exportChartAsPng({
        containerElement: modalChartContainerRef.current,
        datasetName,
        chartTypeSlug: `${chartTypeSlug}_penuh`,
        title,
        subtitle,
      });
      if (ok) {
        showToast(`Grafik "${title}" berhasil diunduh sebagai PNG.`, 'success');
      } else {
        showToast('Gagal mengekspor grafik ke berkas PNG.', 'error');
      }
    } finally {
      setIsExportingPng(false);
    }
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleExportPng}
        disabled={isExportingPng}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
      >
        <Download className="w-4 h-4" />
        <span>Unduh PNG</span>
      </button>
      <button
        type="button"
        onClick={handleExportSvg}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
      >
        <FileCode className="w-4 h-4" />
        <span>Unduh SVG</span>
      </button>
    </>
  );

  return (
    <AccessibleModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
      maxWidthClassName="max-w-6xl"
    >
      {truncationNote && (
        <div className="px-3.5 py-2 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-xs font-medium text-brand-primary-light dark:text-brand-primary-dark tabular-numbers">
          {truncationNote}
        </div>
      )}

      {/* Kanvas Grafik Diperbesar */}
      <div
        ref={modalChartContainerRef}
        className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
      >
        {children}
      </div>

      {/* Narasi Otomatis dari Backend */}
      {narrativeText && (
        <div className="p-4 rounded-button bg-header-light/80 dark:bg-header-dark/80 border border-border-light dark:border-border-dark flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
            <strong className="font-semibold">Narasi Data: </strong>
            <span>{narrativeText}</span>
          </p>
        </div>
      )}

      {/* Tabel Data Sumber Grafik */}
      {dataTable && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            Rincian Data Sumber Visualisasi
          </h3>
          {dataTable}
        </div>
      )}
    </AccessibleModalDialog>
  );
};
