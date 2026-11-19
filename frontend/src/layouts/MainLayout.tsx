import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/Sidebar';
import { BackendStatusBadge } from '@/components/common/BackendStatusBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark">
      {/* Sidebar Kiri untuk Halaman Global */}
      <Sidebar />

      {/* Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Atas Ringkas Halaman Global */}
        <header className="h-16 px-6 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-text-muted-light dark:text-text-muted-dark">
              Lingkungan Kerja Instansi
            </span>
          </div>
          <div className="flex items-center gap-3">
            <BackendStatusBadge />
            <ThemeToggle />
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
