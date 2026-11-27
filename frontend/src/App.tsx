import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MainLayout } from '@/layouts/MainLayout';
import { WorkspaceLayout } from '@/layouts/WorkspaceLayout';
import { ToastContainer } from '@/components/common/Toast';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';

import { HomePage } from '@/pages/HomePage';
import { CatalogPage } from '@/pages/CatalogPage';
import { UploadPage } from '@/pages/UploadPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Code splitting: seluruh tab Workspace dimuat secara lazy agar bundle awal tetap ringan (< 500 KB)
const DataStructureTab = lazy(() =>
  import('@/pages/workspace/DataStructureTab').then((m) => ({
    default: m.DataStructureTab,
  }))
);
const AnomalyEditorTab = lazy(() =>
  import('@/pages/workspace/AnomalyEditorTab').then((m) => ({
    default: m.AnomalyEditorTab,
  }))
);
const AnalyticsTab = lazy(() => import('@/pages/workspace/AnalyticsTab'));
const ForecastingTab = lazy(() => import('@/pages/workspace/ForecastingTab'));

const TabSuspenseFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="p-12 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
    Memuat modul {label}...
  </div>
);

// Inisialisasi React Query Client terpusat
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 detik
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Rute Halaman Global dengan Sidebar Kiri */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Navigate to="/beranda" replace />} />
              <Route path="/beranda" element={<HomePage />} />
              <Route path="/katalog" element={<CatalogPage />} />
              <Route path="/unggah" element={<UploadPage />} />
            </Route>

            {/* Rute Workspace Dataset Layar Penuh (Full-Width) dengan 4 Tab */}
            <Route path="/workspace/:datasetId" element={<WorkspaceLayout />}>
              <Route index element={<Navigate to="data-struktur" replace />} />
              <Route
                path="data-struktur"
                element={
                  <Suspense fallback={<TabSuspenseFallback label="Data & Struktur" />}>
                    <DataStructureTab />
                  </Suspense>
                }
              />
              <Route
                path="review-anomali"
                element={
                  <Suspense fallback={<TabSuspenseFallback label="Review Anomali & Editor" />}>
                    <AnomalyEditorTab />
                  </Suspense>
                }
              />
              <Route
                path="dashboard-analitik"
                element={
                  <Suspense fallback={<TabSuspenseFallback label="Dashboard Analitik" />}>
                    <AnalyticsTab />
                  </Suspense>
                }
              />
              <Route
                path="peramalan-ekspor"
                element={
                  <Suspense fallback={<TabSuspenseFallback label="Peramalan & Ekspor" />}>
                    <ForecastingTab />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Halaman 404 untuk rute tidak dikenal */}
            <Route element={<MainLayout />}>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};

export default App;
