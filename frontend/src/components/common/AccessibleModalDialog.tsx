import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export interface AccessibleModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  maxWidthClassName?: string;
  children: React.ReactNode;
}

/**
 * Komponen Dialog Modal Bersama yang Aksesibel (Fase 5 Butir j):
 * - Memiliki atribut `role="dialog"` dan `aria-modal="true"`.
 * - Mengunci fokus keyboard (focus trap) dengan Tab / Shift+Tab di dalam dialog.
 * - Menutup dialog saat pengguna menekan tombol `Escape`.
 * - Mengembalikan fokus keyboard ke tombol pemicu (`document.activeElement` sebelum dibuka)
 *   begitu dialog ditutup.
 */
export const AccessibleModalDialog: React.FC<AccessibleModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerActions,
  maxWidthClassName = 'max-w-6xl',
  children,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Simpan elemen tombol pemicu sebelum modal mengambil fokus
    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Fokus ke tombol tutup atau elemen interaktif pertama di dalam modal
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableSelector =
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      // Kembalikan fokus ke tombol pemicu
      if (
        triggerElementRef.current &&
        typeof triggerElementRef.current.focus === 'function'
      ) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-canvas-dark/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${maxWidthClassName} rounded-modal bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {/* Header Modal */}
        <div className="px-6 py-4 bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-bold text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {headerActions}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog (Esc)"
              title="Tutup (Esc)"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark min-h-control"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* Body Modal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">{children}</div>
      </div>
    </div>
  );
};
