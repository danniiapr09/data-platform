import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

const TOAST_EVENT_NAME = 'app:show-toast';

/** Fungsi pemanggil toast dari mana saja (termasuk interseptor apiClient) */
export function showToast(message: string, variant: ToastVariant = 'info') {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<Omit<ToastMessage, 'id'>>(TOAST_EVENT_NAME, {
    detail: { message, variant },
  });
  window.dispatchEvent(event);
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<ToastMessage, 'id'>>;
      const { message, variant } = customEvent.detail;

      setToasts((prev) => {
        // Cegah duplikasi pesan identik yang masih tampil di layar
        if (prev.some((t) => t.message === message && t.variant === variant)) {
          return prev;
        }
        const newToast: ToastMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          message,
          variant,
        };
        return [...prev.slice(-3), newToast];
      });
    };

    window.addEventListener(TOAST_EVENT_NAME, handleEvent);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handleEvent);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = window.setTimeout(() => {
      removeToast(latest.id);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 w-full max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((item) => {
        const isError = item.variant === 'error';
        const isSuccess = item.variant === 'success';

        let containerClasses =
          'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark';
        let iconNode = <Info className="w-5 h-5 text-brand-cyan flex-shrink-0" />;

        if (isError) {
          containerClasses =
            'bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark';
          iconNode = <AlertCircle className="w-5 h-5 flex-shrink-0" />;
        } else if (isSuccess) {
          containerClasses =
            'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark border-anomaly-success-text-light/30 dark:border-anomaly-success-text-dark/40 text-anomaly-success-text-light dark:text-anomaly-success-text-dark';
          iconNode = <CheckCircle2 className="w-5 h-5 flex-shrink-0" />;
        }

        return (
          <div
            key={item.id}
            role={isError ? 'alert' : 'status'}
            className={`pointer-events-auto w-full flex items-start justify-between gap-3 px-4 py-3 rounded-card border shadow-lg text-sm font-medium transition-all ${containerClasses}`}
          >
            <div className="flex items-start gap-2.5">
              {iconNode}
              <span className="leading-snug">{item.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              aria-label="Tutup notifikasi"
              className="p-1 rounded-button hover:bg-canvas-light/40 dark:hover:bg-canvas-dark/40 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
