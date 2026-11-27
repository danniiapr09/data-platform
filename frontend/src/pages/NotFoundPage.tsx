import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  useDocumentTitle('Halaman Tidak Ditemukan');

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 bg-canvas-light dark:bg-canvas-dark">
      <div className="max-w-lg w-full p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-brand-primary-light dark:text-brand-primary-dark">
            404 • Rute Tidak Tersedia
          </p>
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Alamat halaman yang Anda buka tidak tersedia atau sudah dipindahkan.
            Silakan kembali ke Beranda atau pilih dataset dari Katalog Dataset.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Button
            variant="primary"
            icon={<Home className="w-4 h-4" />}
            onClick={() => navigate('/beranda')}
          >
            Kembali ke Beranda
          </Button>
          <Button
            variant="secondary"
            icon={<Database className="w-4 h-4" />}
            onClick={() => navigate('/katalog')}
          >
            Buka Katalog Dataset
          </Button>
        </div>
      </div>
    </div>
  );
};
