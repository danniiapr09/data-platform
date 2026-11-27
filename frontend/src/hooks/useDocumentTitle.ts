import { useEffect } from 'react';

export const APP_TITLE = 'Platform Data & Forecasting';

/**
 * Memperbarui judul tab browser secara dinamis per halaman dan dataset.
 */
export function useDocumentTitle(pageTitle?: string | null): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${APP_TITLE}` : APP_TITLE;
  }, [pageTitle]);
}
