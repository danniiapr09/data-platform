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
  const timersRef = React.useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
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
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newToast: ToastMessage = { id, message, variant };
        const timerId = window.setTimeout(() => {
          removeToast(id);
        }, 5000);
        timersRef.current.set(id, timerId);
        return [...prev.slice(-3), newToast];
      });
    };

    window.addEventListener(TOAST_EVENT_NAME, handleEvent);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, handleEvent);
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current.clear();
    };
  }, [removeToast]);

  const errorToasts = toasts.filter((t) => t.variant === 'error');
  const politeToasts = toasts.filter((t) => t.variant !== 'error');

  const renderToastItem = (item: ToastMessage) => {
    const isError = item.variant === 'error';
    const isSuccess = item.variant === 'success';

    let containerClasses =
      'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark';
    let iconNode = <Info className="w-5 h-5 text-brand-cyan flex-shrink-0" aria-hidden="true" />;

    if (isError) {
      containerClasses =
        'bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark';
      iconNode = <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />;
    } else if (isSuccess) {
      containerClasses =
        'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark border-anomaly-success-text-light/30 dark:border-anomaly-success-text-dark/40 text-anomaly-success-text-light dark:text-anomaly-success-text-dark';
      iconNode = <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />;
    }

    return (
      <div
        key={item.id}
        className={`pointer-events-auto w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-card border shadow-lg text-sm font-medium transition-all ${containerClasses}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          {iconNode}
          <span className="leading-snug">{item.message}</span>
        </div>
        <button
          type="button"
          onClick={() => removeToast(item.id)}
          aria-label="Tutup notifikasi"
          className="inline-flex items-center justify-center min-h-control min-w-[38px] rounded-button hover:bg-canvas-light/40 dark:hover:bg-canvas-dark/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 w-full max-w-sm pointer-events-none">
      {/* Live region terpisah agar selalu ter-mount untuk pembaca layar */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="false"
        className="w-full flex flex-col items-end gap-2.5"
      >
        {errorToasts.map(renderToastItem)}
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="w-full flex flex-col items-end gap-2.5"
      >
        {politeToasts.map(renderToastItem)}
      </div>
    </div>
  );
};
