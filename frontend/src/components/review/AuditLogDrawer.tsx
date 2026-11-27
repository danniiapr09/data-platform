import React, { useEffect, useRef } from 'react';
import {
  ArrowRight,
  Clock,
  Edit3,
  History,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import { DataEditsListResponse } from '@/types/dataset';
import {
  formatCellValueId,
  formatDateTimeId,
  formatNumberId,
  formatPercentId,
} from '@/utils/formatters';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editsResponse?: DataEditsListResponse;
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}

/**
 * Slide-over Drawer "Riwayat Perubahan Data (Audit Log)" (F-20)
 * Menampilkan data nyata dari GET /datasets/{id}/edits:
 * - Kartu ringkasan transparansi (deskripsi backend, total perubahan, baris diedit, staf pengedit)
 * - Tabel riwayat perubahan memuat: Versi Baru (v{versi_baru}), Baris File (#{baris_di_file_asli}),
 *   Kolom, Nilai Lama -> Nilai Baru, Alasan Perubahan, Diubah Oleh, dan Waktu Perubahan.
 */
export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({
  isOpen,
  onClose,
  editsResponse,
  isLoading,
  isFetching,
  onRefresh,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !drawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !drawerRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      triggerElementRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const ringkasan = editsResponse?.ringkasan;
  const editsList = editsResponse?.data || [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-canvas-dark/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-audit-log-title"
    >
      {/* Area klik luar untuk menutup drawer */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      {/* Kontainer Slide-over Drawer */}
      <div
        ref={drawerRef}
        className="w-full max-w-4xl h-full bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header Drawer */}
        <div className="px-6 py-4 bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-button bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark">
              <History className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="drawer-audit-log-title"
                className="text-base font-bold text-text-primary-light dark:text-text-primary-dark"
              >
                Riwayat Perubahan Data (Audit Log)
              </h2>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Rekam jejak koreksi nilai sel manual beserta nomor baris berkas asli, alasan, dan pengedit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark transition-colors min-h-control"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Segarkan</span>
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Tutup drawer Audit Log"
              className="inline-flex items-center justify-center min-w-[38px] p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark transition-colors min-h-control"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Konten Drawer */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Kartu Ringkasan Transparansi dari ringkasan GET /edits */}
          {ringkasan && (
            <div className="space-y-4">
              <div className="p-4 rounded-card bg-modified-bg-light/30 dark:bg-modified-bg-dark/30 border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark border-t border-r border-b border-border-light dark:border-border-dark">
                <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  {ringkasan.deskripsi}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark block">
                    Total Perubahan Sel
                  </span>
                  <span className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-0.5 block">
                    {formatNumberId(ringkasan.jumlah_perubahan, 0)}
                  </span>
                </div>

                <div className="p-3.5 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark block">
                    Sel Unik Diedit
                  </span>
                  <span className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-0.5 block">
                    {formatNumberId(ringkasan.sel_unik, 0)} sel
                  </span>
                </div>

                <div className="p-3.5 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark block">
                    Persentase Baris Diedit
                  </span>
                  <span className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-0.5 block">
                    {ringkasan.persen_baris_diedit !== null
                      ? formatPercentId(ringkasan.persen_baris_diedit)
                      : '-'}
                  </span>
                  <span className="text-xs text-text-muted-light dark:text-text-secondary-dark font-mono tabular-numbers">
                    ({formatNumberId(ringkasan.baris_unik, 0)} /{' '}
                    {formatNumberId(ringkasan.baris_bersih, 0)} baris)
                  </span>
                </div>

                <div className="p-3.5 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark block">
                    Staf Pengedit
                  </span>
                  <span className="text-xs font-mono font-semibold text-text-primary-light dark:text-text-primary-dark mt-1 block break-words">
                    {ringkasan.pengedit.length > 0
                      ? ringkasan.pengedit.join(', ')
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tabel Riwayat Audit Log */}
          <div className="rounded-card border border-border-light dark:border-border-dark overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
                Memuat riwayat perubahan data...
              </div>
            ) : editsList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Edit3 className="w-8 h-8 mx-auto text-text-muted-light dark:text-text-secondary-dark" />
                <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                  Belum Ada Riwayat Edit Manual
                </p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark max-w-md mx-auto">
                  Setiap koreksi nilai sel yang Anda simpan melalui tombol Edit pada sel beranomali akan tercatat secara otomatis di sini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" aria-label="Tabel Riwayat Perubahan Data Manual">
                  <thead>
                    <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                      <th scope="col" className="py-3 px-4 whitespace-nowrap">Versi</th>
                      <th
                        scope="col"
                        className="py-3 px-4 whitespace-nowrap"
                        title="Nomor baris pada berkas asli (baris 1 adalah header)"
                      >
                        No. Baris
                      </th>
                      <th scope="col" className="py-3 px-4 whitespace-nowrap">Kolom</th>
                      <th scope="col" className="py-3 px-4 whitespace-nowrap">
                        Nilai Lama → Nilai Baru
                      </th>
                      <th scope="col" className="py-3 px-4">Alasan Perubahan</th>
                      <th scope="col" className="py-3 px-4 whitespace-nowrap">
                        Diubah Oleh
                      </th>
                      <th scope="col" className="py-3 px-4 whitespace-nowrap">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                    {editsList.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-sm font-bold whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark">
                            v{item.versi_baru}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-sm font-bold tabular-numbers whitespace-nowrap text-text-primary-light dark:text-text-primary-dark">
                          #{formatNumberId(item.baris_di_file_asli, 0)}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm font-semibold whitespace-nowrap text-brand-primary-light dark:text-brand-primary-dark">
                          {item.kolom}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm tabular-numbers whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark line-through">
                              {formatCellValueId(item.nilai_lama)}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0" aria-hidden="true" />
                            <span className="px-2 py-0.5 rounded-button bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark font-bold">
                              {formatCellValueId(item.nilai_baru)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-text-primary-light dark:text-text-primary-dark min-w-[200px]">
                          {item.alasan}
                        </td>
                        <td className="py-3 px-4 text-sm font-mono whitespace-nowrap text-text-secondary-light dark:text-text-secondary-dark">
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{item.diubah_oleh}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-mono tabular-numbers whitespace-nowrap text-text-secondary-light dark:text-text-secondary-dark">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{formatDateTimeId(item.waktu)}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
