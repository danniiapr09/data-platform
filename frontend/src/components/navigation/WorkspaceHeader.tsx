import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Database,
  Table,
  Sparkles,
  TrendingUp,
  BarChart2,
  Plus,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/common/Button';
import {
  FormatFileBadge,
  ProcessingStatusBadge,
} from '@/components/common/StatusBadge';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import { DatasetDetail } from '@/types/dataset';
import { formatNumberId, normalizeJenisLabel } from '@/utils/formatters';

interface WorkspaceHeaderProps {
  dataset?: DatasetDetail;
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  dataset,
  isLoading,
  isFetching,
  onRefresh,
}) => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  const pendingAnomalies = dataset?.anomali?.pending || 0;

  const tabs = [
    {
      to: `/workspace/${datasetId}/data-struktur`,
      label: '1. Data & Struktur',
      icon: <Table className="w-4 h-4" />,
      badge: null,
    },
    {
      to: `/workspace/${datasetId}/review-anomali`,
      label: '2. Review Anomali & Editor',
      icon: <Sparkles className="w-4 h-4" />,
      badge: pendingAnomalies > 0 ? pendingAnomalies : null,
    },
    {
      to: `/workspace/${datasetId}/dashboard-analitik`,
      label: '3. Dashboard Analitik',
      icon: <BarChart2 className="w-4 h-4" />,
      badge: null,
    },
    {
      to: `/workspace/${datasetId}/peramalan-ekspor`,
      label: '4. Peramalan & Ekspor',
      icon: <TrendingUp className="w-4 h-4" />,
      badge: null,
    },
  ];

  return (
    <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex-shrink-0">
      {/* Baris Atas: Breadcrumb & Kontrol Sistem */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-border-light dark:border-border-dark">
        <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark min-w-0">
          <NavLink
            to="/beranda"
            className="font-semibold text-text-primary-light dark:text-text-primary-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark transition-colors flex-shrink-0"
          >
            Platform Data & Forecasting
          </NavLink>
          <ChevronRight className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
          <NavLink
            to="/beranda"
            className="hover:text-text-primary-light dark:hover:text-text-primary-dark flex-shrink-0"
          >
            Beranda
          </NavLink>
          <ChevronRight className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
          <NavLink
            to="/katalog"
            className="hover:text-text-primary-light dark:hover:text-text-primary-dark flex-shrink-0"
          >
            Katalog Dataset
          </NavLink>
          <ChevronRight className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark flex-shrink-0" />
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark font-mono truncate">
            {isLoading ? 'Memuat...' : dataset?.nama || `Dataset #${datasetId}`}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <BackendStatusBadge />
          <ThemeToggle />
          <span className="px-2.5 py-1 rounded-button text-xs font-semibold bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark">
            Admin
          </span>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/unggah')}
          >
            Unggah Dataset Baru
          </Button>
        </div>
      </div>

      {/* Baris Tengah: Metadata Nyata dari GET /datasets/{id} */}
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-header-light/40 dark:bg-header-dark/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark font-mono truncate">
                {isLoading ? 'Memuat informasi dataset...' : dataset?.nama || '-'}
              </h1>
              {dataset && (
                <>
                  <FormatFileBadge namaDataset={dataset.nama} />
                  <ProcessingStatusBadge status={dataset.status} />
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full font-mono bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark">
                    {dataset.versi_bersih !== null
                      ? `Versi Bersih: v${dataset.versi_bersih}`
                      : 'Data Mentah: v0'}
                  </span>
                  {/* Penanda kesegaran data React Query (Live Sync hanya muncul saat B02_LIVE_SYNC_CHANNEL aktif) */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark">
                    {isFetching ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-brand-cyan flex-shrink-0" />
                        <span>Menyegarkan...</span>
                      </>
                    ) : BACKEND_CAPABILITIES.B02_LIVE_SYNC_CHANNEL ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-anomaly-success-text-light dark:bg-anomaly-success-text-dark flex-shrink-0" />
                        <span>Live Sync • Data terkini</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-anomaly-success-text-light dark:bg-anomaly-success-text-dark flex-shrink-0" />
                        <CheckCircle2 className="w-3.5 h-3.5 text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex-shrink-0" />
                        <span>Data terkini</span>
                      </>
                    )}
                  </span>
                </>
              )}
            </div>

            {dataset && (
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-text-muted-light dark:text-text-muted-dark">
                <span>
                  Kategori:{' '}
                  <strong className="text-text-secondary-light dark:text-text-secondary-dark">
                    {normalizeJenisLabel(dataset.jenis)}
                  </strong>
                </span>
                <span>•</span>
                <span className="tabular-numbers">
                  Baris Mentah: {formatNumberId(dataset.baris_mentah, 0)}
                </span>
                {dataset.versi_bersih !== null && (
                  <>
                    <span>•</span>
                    <span className="tabular-numbers">
                      Baris Bersih: {formatNumberId(dataset.baris_bersih, 0)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={onRefresh}
            disabled={isFetching}
          >
            Segarkan Data
          </Button>
        </div>
      </div>

      {/* Baris Bawah: 4 Tab Modular Workspace */}
      <nav
        className="px-6 flex gap-2 overflow-x-auto border-t border-border-light dark:border-border-dark"
        aria-label="Tab Workspace Dataset"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap min-h-control ${
                isActive
                  ? 'border-brand-primary-light dark:border-brand-primary-dark text-brand-primary-light dark:text-brand-primary-dark bg-surface-light dark:bg-surface-dark'
                  : 'border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark hover:border-border-light dark:hover:border-border-dark'
              }`
            }
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== null && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full tabular-numbers bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                {formatNumberId(tab.badge, 0)}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};
