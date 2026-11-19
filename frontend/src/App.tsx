import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MainLayout } from '@/layouts/MainLayout';
import { WorkspaceLayout } from '@/layouts/WorkspaceLayout';

import { HomePage } from '@/pages/HomePage';
import { CatalogPage } from '@/pages/CatalogPage';
import { UploadPage } from '@/pages/UploadPage';

import { DataStructureTab } from '@/pages/workspace/DataStructureTab';
import { AnomalyEditorTab } from '@/pages/workspace/AnomalyEditorTab';
import { AnalyticsTab } from '@/pages/workspace/AnalyticsTab';
import { ForecastingTab } from '@/pages/workspace/ForecastingTab';

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
            <Route path="data-struktur" element={<DataStructureTab />} />
            <Route path="review-anomali" element={<AnomalyEditorTab />} />
            <Route path="dashboard-analitik" element={<AnalyticsTab />} />
            <Route path="peramalan-ekspor" element={<ForecastingTab />} />
          </Route>

          {/* Fallback ke Beranda jika rute tidak ditemukan */}
          <Route path="*" element={<Navigate to="/beranda" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
