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
      {/* Sidebar Kiri untuk Halaman Global */}
      <Sidebar />

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Atas Halaman Global */}
        <header className="h-16 px-6 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <NavLink
              to="/beranda"
              className="font-semibold text-text-primary-light dark:text-text-primary-dark hover:text-brand-primary-light dark:hover:text-brand-primary-dark transition-colors"
            >
              Platform Data & Forecasting
            </NavLink>
            <ChevronRight className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
            <span className="text-text-secondary-light dark:text-text-secondary-dark font-medium">
              {getCurrentPageLabel()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <BackendStatusBadge />
            <ThemeToggle />
            <span className="px-2.5 py-1 rounded-button text-xs font-semibold bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark">
              Admin
            </span>
            {!location.pathname.startsWith('/unggah') && (
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => navigate('/unggah')}
              >
                Unggah Dataset Baru
              </Button>
            )}
          </div>
        </header>

        {/* Area Tampilan Halaman */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
