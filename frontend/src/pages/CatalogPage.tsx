import React from 'react';
import { Database, Plus, Search } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useNavigate } from 'react-router-dom';

export const CatalogPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Katalog Registri Dataset Instansi
          </h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Kelola, tinjau kualitas, dan akses berkas dataset tabular kedinasan yang terdaftar.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/unggah')}
        >
          Unggah Dataset Baru
        </Button>
      </div>

      {/* Filter & Kontrol Pencarian Sementara */}
      <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-muted-dark" />
          <input
            type="text"
            disabled
            placeholder="Pencarian dataset akan aktif pada Fase 2..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark min-h-control cursor-not-allowed opacity-60"
          />
        </div>
      </div>

      {/* Kartu Penampung Tabel Katalog */}
      <div className="p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark mx-auto flex items-center justify-center">
          <Database className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          Tabel Katalog Dataset (Fase 1: Penampung Kosong)
        </h3>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-lg mx-auto">
          Daftar dataset tabular akan dimuat secara dinamis dari endpoint <span className="font-mono text-xs">GET /datasets</span> pada implementasi Fase 2.
        </p>
        <div className="pt-2">
          <Button variant="secondary" onClick={() => navigate('/workspace/demo/data-struktur')}>
            Buka Pratinjau Workspace Demo
          </Button>
        </div>
      </div>
    </div>
  );
};
