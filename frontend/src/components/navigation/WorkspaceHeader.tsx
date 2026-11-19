import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { ChevronRight, Database, Table, Sparkles, TrendingUp, BarChart2 } from 'lucide-react';
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export const WorkspaceHeader: React.FC = () => {
  const { datasetId = 'demo' } = useParams<{ datasetId: string }>();

  const tabs = [
    {
      to: `/workspace/${datasetId}/data-struktur`,
      label: '1. Data & Struktur',
      icon: <Table className="w-4 h-4" />,
    },
    {
      to: `/workspace/${datasetId}/review-anomali`,
      label: '2. Review Anomali & Editor',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      to: `/workspace/${datasetId}/dashboard-analitik`,
      label: '3. Dashboard Analitik',
      icon: <BarChart2 className="w-4 h-4" />,
    },
    {
      to: `/workspace/${datasetId}/peramalan-ekspor`,
      label: '4. Peramalan & Ekspor',
      icon: <TrendingUp className="w-4 h-4" />,
    },
  ];

  return (
    <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex-shrink-0">
      {/* Baris Atas: Breadcrumb & Kontrol Sistem */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-border-light dark:border-border-dark">
        <div className="flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          <NavLink to="/beranda" className="hover:text-text-primary-light dark:hover:text-text-primary-dark">
            Beranda
          </NavLink>
          <ChevronRight className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
          <NavLink to="/katalog" className="hover:text-text-primary-light dark:hover:text-text-primary-dark">
            Katalog Registri
          </NavLink>
          <ChevronRight className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
          <span className="font-semibold text-text-primary-light dark:text-text-primary-dark font-mono">
            {datasetId}.xlsx
          </span>
        </div>

        <div className="flex items-center gap-3">
          <BackendStatusBadge />
          <ThemeToggle />
        </div>
      </div>

      {/* Baris Tengah: Info Meta Dataset */}
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-header-light/40 dark:bg-header-dark/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark font-mono">
                {datasetId}.xlsx
              </h1>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-brand-cyan/20 text-brand-cyan">
                XLSX
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                Terverifikasi
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted-light dark:text-text-muted-dark font-mono">
              <span>Mode: Layar Penuh Workspace</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-anomaly-success-text-light dark:text-anomaly-success-text-dark font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-anomaly-success-text-light dark:bg-anomaly-success-text-dark animate-pulse" />
                Live Sync Siap
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Baris Bawah: 4 Tab Modular Workspace */}
      <nav className="px-6 flex gap-2 overflow-x-auto border-t border-border-light dark:border-border-dark">
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
          </NavLink>
        ))}
      </nav>
    </header>
  );
};
