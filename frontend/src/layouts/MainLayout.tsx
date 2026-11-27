import React from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/common/Button';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const getCurrentPageLabel = () => {
    if (location.pathname.startsWith('/katalog')) return 'Katalog Dataset';
    if (location.pathname.startsWith('/unggah')) return 'Unggah Dataset Baru';
    return 'Beranda';
  };

  return (
    <div className="flex min-h-screen bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-button focus:bg-brand-primary-light focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Lewati ke konten utama
      </a>
      {/* Sidebar Kiri untuk Halaman Global */}
      <Sidebar />

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Atas Halaman Global */}
        <header className="min-h-16 px-4 xl:px-6 py-2 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
            <NavLink
              to="/beranda"
              className="font-semibold text-text-primary-light dark:text-text-primary-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark rounded-sm"
            >
              Platform Data & Forecasting
            </NavLink>
            <ChevronRight className="w-4 h-4 text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0" aria-hidden="true" />
            <span className="text-text-secondary-light dark:text-text-secondary-dark font-medium truncate">
              {getCurrentPageLabel()}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 xl:gap-3 flex-shrink-0">
            <BackendStatusBadge />
            <ThemeToggle />
            <span className="px-2.5 py-1 rounded-button text-xs font-semibold bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark whitespace-nowrap">
              Admin
            </span>
            {!location.pathname.startsWith('/unggah') && (
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => navigate('/unggah')}
                className="whitespace-nowrap"
              >
                Unggah Dataset Baru
              </Button>
            )}
          </div>
        </header>

        {/* Area Tampilan Halaman */}
        <main id="main-content" tabIndex={-1} className="flex-1 p-6 overflow-y-auto focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
