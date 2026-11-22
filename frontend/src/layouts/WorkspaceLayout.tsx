import React from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { WorkspaceHeader } from '@/components/navigation/WorkspaceHeader';
import { Button } from '@/components/common/Button';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    enabled: Boolean(datasetId),
  });

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
  };

  const errorMessage =
    (error as Error & { localizedMessage?: string })?.localizedMessage ||
    'Gagal memuat metadata dataset. Pastikan ID dataset valid dan server backend aktif.';

  return (
    <div className="flex flex-col min-h-screen bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark">
      {/* Header Khusus Workspace: Breadcrumb, Metadata Nyata, dan 4 Tab */}
      <WorkspaceHeader
        dataset={dataset}
        isLoading={isLoading}
        isFetching={isFetching}
        onRefresh={handleRefreshAll}
      />

      {/* Konten Tab Workspace (Layar Penuh / Full-Width Desktop) */}
      <main className="flex-1 p-6 overflow-y-auto">
        {isError ? (
          <div className="max-w-3xl mx-auto p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                  Tidak Dapat Memuat Workspace Dataset
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
              <Button
                variant="primary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={handleRefreshAll}
              >
                Coba Lagi
              </Button>
            </div>
          </div>
        ) : (
          <Outlet
            context={{
              dataset,
              isLoading,
              isFetching,
              refetchDataset: handleRefreshAll,
            } satisfies WorkspaceOutletContext}
          />
        )}
      </main>
    </div>
  );
};
