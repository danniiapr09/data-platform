import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Database, UploadCloud } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    {
      to: '/beranda',
      label: 'Beranda',
      icon: <BarChart3 className="w-5 h-5" aria-hidden="true" />,
    },
    {
      to: '/katalog',
      label: 'Katalog Dataset',
      icon: <Database className="w-5 h-5" aria-hidden="true" />,
    },
    {
      to: '/unggah',
      label: 'Unggah Dataset Baru',
      icon: <UploadCloud className="w-5 h-5" aria-hidden="true" />,
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex flex-col min-h-screen">
      <div className="h-16 px-4 border-b border-border-light dark:border-border-dark flex items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-button bg-brand-primary-light dark:bg-brand-cyan flex items-center justify-center text-white dark:text-canvas-dark font-bold text-sm" aria-hidden="true">
            PD
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-text-primary-light dark:text-text-primary-dark">
              Platform Data & Forecasting
            </p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Sistem Registri & Analisis
            </p>
          </div>
        </div>
      </div>

      <nav className="p-3 space-y-1 flex-1" aria-label="Navigasi Global">
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
          Navigasi Workspace
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
                isActive
                  ? 'bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark font-semibold border-l-4 border-brand-primary-light dark:border-brand-primary-dark'
                  : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
