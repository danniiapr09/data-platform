import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { formatNumberId } from '@/utils/formatters';

interface CleanConflictModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  versiBersihSaatIni: number | null;
  jumlahEditManual: number;
  jumlahReviewDiterapkan: number;
  serverConflictDetail?: string | null;
  onCancel: () => void;
  onConfirmOverwrite: () => void;
}

/**
 * Modal Konfirmasi Penimpaan Pembersihan Otomatis (HTTP 409 Conflict -> ?timpa=true)
 * Sesuai F-11 PRD dan Aturan Konten Fase 3:
 * Menjelaskan dengan tegas bahwa pembersihan ulang akan membuat versi baru dari data mentah (v0)
 * dan hasil edit manual / review yang pernah diterapkan pada versi saat ini tidak terbawa.
 */
export const CleanConflictModal: React.FC<CleanConflictModalProps> = ({
  isOpen,
  isSubmitting,
  versiBersihSaatIni,
  jumlahEditManual,
  jumlahReviewDiterapkan,
  serverConflictDetail,
  onCancel,
  onConfirmOverwrite,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas-dark/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-clean-conflict-title"
    >
      <div className="w-full max-w-lg rounded-modal bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border-b border-border-light dark:border-border-dark flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3
              id="modal-clean-conflict-title"
              className="text-base font-bold"
            >
              Konfirmasi Pembersihan Ulang (Menimpa Perubahan Manual)
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Tutup dialog konfirmasi"
            className="p-1.5 rounded-button text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light/60 dark:hover:bg-surface-dark/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 space-y-4 text-sm text-text-primary-light dark:text-text-primary-dark">
          <p className="leading-relaxed">
            Dataset ini sudah memiliki perubahan kurasi manual pada{' '}
            <strong className="font-mono">
              Versi Bersih v{versiBersihSaatIni ?? 1}
            </strong>
            . Menjalankan pembersihan otomatis ulang akan membaca ulang{' '}
            <strong className="font-mono">Data Mentah (v0)</strong>, membuat{' '}
            <strong className="font-mono">
              Versi Bersih v{(versiBersihSaatIni ?? 1) + 1}
            </strong>
            , dan <strong>membuang seluruh hasil edit manual serta status review anomali</strong> pada versi saat ini.
          </p>

          {/* Rincian Dampak */}
          <div className="p-4 rounded-card bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark space-y-2 text-xs">
            <div className="font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              Rincian Perubahan yang Akan Direset:
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <span className="text-text-muted-light dark:text-text-muted-dark block">
                  Koreksi Sel Manual
                </span>
                <span className="text-base font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(jumlahEditManual, 0)} perubahan
                </span>
              </div>
              <div className="p-2.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                <span className="text-text-muted-light dark:text-text-muted-dark block">
                  Penerapan Review
                </span>
                <span className="text-base font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(jumlahReviewDiterapkan, 0)} kali
                </span>
              </div>
            </div>
          </div>

          {serverConflictDetail && (
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark italic">
              Pesan server: &ldquo;{serverConflictDetail}&rdquo;
            </p>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="px-6 py-4 bg-header-light/50 dark:bg-header-dark/50 border-t border-border-light dark:border-border-dark flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirmOverwrite}
            disabled={isSubmitting}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`}
              />
            }
          >
            {isSubmitting
              ? 'Menjalankan Pembersihan...'
              : 'Ya, Timpa & Bersihkan Ulang'}
          </Button>
        </div>
      </div>
    </div>
  );
};
