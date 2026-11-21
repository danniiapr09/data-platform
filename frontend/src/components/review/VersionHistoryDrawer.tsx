import React, { useEffect, useRef } from 'react';
import { History, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { ProcessingTimelineList } from '@/components/common/ProcessingTimelineList';
import { HistoryLogItem } from '@/types/dataset';
import { formatNumberId } from '@/utils/formatters';

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  historyLogs: HistoryLogItem[];
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  versiBersihSaatIni: number | null;
}

/**
 * Slide-over Drawer "Riwayat Pemrosesan" (Penyesuaian Wajib butir e)
 * - Memakai ulang komponen Linimasa (ProcessingTimelineList) dari Tab 1.
 * - Menampilkan jumlah langkah pemrosesan sebenarnya dari GET /datasets/{id}/history.
 * - Tidak ada fitur kembali ke versi lama (karena backend selalu membaca versi terbaru).
 */
export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  historyLogs,
  isLoading,
  isFetching,
  onRefresh,
  versiBersihSaatIni,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-canvas-dark/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-processing-history-title"
    >
      {/* Area klik luar untuk menutup drawer */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      {/* Kontainer Slide-over Drawer */}
      <div className="w-full max-w-2xl h-full bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark shadow-2xl flex flex-col overflow-hidden">
        {/* Header Drawer */}
        <div className="px-6 py-4 bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-cyan">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="drawer-processing-history-title"
                className="text-base font-bold text-text-primary-light dark:text-text-primary-dark"
              >
                Riwayat Pemrosesan ({formatNumberId(historyLogs.length, 0)}{' '}
                Langkah)
              </h3>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Linimasa aktivitas pemrosesan dataset dari unggah, pembersihan, edit sel, hingga penerapan review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors min-h-control"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
              />
              <span>Segarkan</span>
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Tutup drawer Riwayat Pemrosesan"
              className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors min-h-control"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Konten Drawer */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Keterangan Versi Aktif & Ketidaktersediaan Fitur Kembali ke Versi Lama */}
          <div className="p-4 rounded-card bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark space-y-1">
              <div className="font-bold text-text-primary-light dark:text-text-primary-dark">
                Versi Data Bersih Aktif Saat Ini:{' '}
                <span className="font-mono">
                  {versiBersihSaatIni !== null
                    ? `v${versiBersihSaatIni}`
                    : 'v0 (Belum Di-cleaning)'}
                </span>
              </div>
              <p>
                Setiap pembersihan otomatis, koreksi sel manual, atau penerapan hasil review menciptakan versi data bersih baru. Versi sebelumnya tetap tersimpan di database server sebagai arsip audit, namun aplikasi hanya mengoperasikan versi data bersih terbaru.
              </p>
            </div>
          </div>

          {/* Linimasa Aktivitas (komponen bersama dari Tab 1) */}
          <div className="p-5 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark">
            <ProcessingTimelineList
              historyLogs={historyLogs}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
