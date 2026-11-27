import React from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { WorkspaceHeader } from '@/components/navigation/WorkspaceHeader';
import { Button } from '@/components/common/Button';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { WorkspaceTabStateProvider } from '@/context/WorkspaceTabStateContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getDatasetDetail } from '@/services/datasetService';
import { DatasetDetail } from '@/types/dataset';

export interface WorkspaceOutletContext {
  dataset?: DatasetDetail;
  isLoading: boolean;
  isFetching: boolean;
  refetchDataset: () => void;
}

export const WorkspaceLayout: React.FC = () => {
  const { datasetId = '' } = useParams<{ datasetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isValidDatasetId = /^\d+$/.test(datasetId) && Number(datasetId) > 0;

  const {
    data: dataset,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dataset-detail', datasetId],
    queryFn: () => getDatasetDetail(datasetId),
    enabled: isValidDatasetId,
  });

  const activeTabLabel = location.pathname.includes('/review-anomali')
    ? 'Review Anomali & Editor'
    : location.pathname.includes('/dashboard-analitik')
    ? 'Dashboard Analitik'
    : location.pathname.includes('/peramalan-ekspor')
    ? 'Peramalan & Ekspor'
    : 'Data & Struktur';

  useDocumentTitle(
    !isValidDatasetId
      ? 'ID Dataset Tidak Valid'
      : dataset?.nama
      ? `${dataset.nama} · ${activeTabLabel}`
      : activeTabLabel
  );

  const handleRefreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['dataset-preview', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-clean-preview', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-clean-report', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-history', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-anomalies-summary', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-anomalies-items', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-edits', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-unified-review', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-apply-review-preview', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-compare-options', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-eda', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-eda-distribution', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-eda-trend', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-eda-trend-secondary', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-compare-full', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-compare-periode', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-ratio', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-b07-matrix', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-b07-hierarchy', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-forecast-report', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-forecast-rows', datasetId] });
    queryClient.invalidateQueries({ queryKey: ['dataset-forecast-trend', datasetId] });
  };

  const errorMessage = !isValidDatasetId
    ? `ID dataset "${datasetId}" tidak valid. Gunakan ID numerik dataset yang terdaftar di Katalog Dataset.`
    : (error as Error & { localizedMessage?: string })?.localizedMessage ||
      'Gagal memuat informasi dataset. Pastikan dataset masih tersedia dan server aktif.';

  return (
    <div className="flex flex-col min-h-screen bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-button focus:bg-brand-primary-light focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>
      {/* Header Khusus Workspace: Breadcrumb, Metadata Nyata, dan 4 Tab */}
      <WorkspaceHeader
        dataset={dataset}
        isLoading={isLoading}
        isFetching={isFetching}
        onRefresh={handleRefreshAll}
      />

      {/* Konten Tab Workspace (Layar Penuh / Full-Width Desktop) */}
      <main id="main-content" tabIndex={-1} className="flex-1 p-6 overflow-y-auto focus:outline-none">
        {!isValidDatasetId || isError ? (
          <div className="max-w-3xl mx-auto p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                  {!isValidDatasetId
                    ? 'ID Dataset Tidak Valid'
                    : 'Tidak Dapat Memuat Workspace Dataset'}
                </h2>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                  {errorMessage}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="secondary"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => navigate('/katalog')}
              >
                Kembali ke Katalog Dataset
              </Button>
              {isValidDatasetId && (
                <Button
                  variant="primary"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={handleRefreshAll}
                >
                  Coba Lagi
                </Button>
              )}
            </div>
          </div>
        ) : (
          <AppErrorBoundary scopeLabel="Workspace Dataset">
            <WorkspaceTabStateProvider datasetId={datasetId}>
              <Outlet
                context={{
                  dataset,
                  isLoading,
                  isFetching,
                  refetchDataset: handleRefreshAll,
                } satisfies WorkspaceOutletContext}
              />
            </WorkspaceTabStateProvider>
          </AppErrorBoundary>
        )}
      </main>
    </div>
  );
};
