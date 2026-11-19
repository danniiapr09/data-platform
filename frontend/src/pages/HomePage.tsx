import React from 'react';
import { BarChart3, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useNavigate } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div>
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Ringkasan Eksekutif & Kurasi Data
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Pantau kesehatan registri dataset instansi dan tindak lanjut verifikasi anomali secara real-time.
        </p>
      </div>

      {/* Kartu Penampung Status Fase 1 */}
      <div className="p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-button bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
              Modul Ringkasan Beranda (Fase 1: Kerangka Siap)
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
              Komponen kartu metrik ringkasan (total dataset, distribusi status, anomali pending, dan kelengkapan data) akan dihubungkan ke endpoint <span className="font-mono text-xs">GET /ringkasan</span> pada Fase 2 setelah pendaftaran router backend selesai (TODO: B-01).
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border-light dark:border-border-dark flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-muted-light dark:text-text-muted-dark">
            <Clock className="w-4 h-4" />
            <span>Menunggu data registri dari backend</span>
          </div>
          <Button variant="secondary" onClick={() => navigate('/katalog')}>
            Buka Katalog Dataset
          </Button>
        </div>
      </div>

      {/* Banner Informasi Kesiapan Sistem */}
      <div className="p-4 rounded-card bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex items-center gap-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
        <AlertCircle className="w-5 h-5 text-brand-cyan flex-shrink-0" />
        <span>
          Fondasi navigasi hybrid dan klien API terpusat telah aktif. Seluruh data disiapkan untuk sinkronisasi otomatis.
        </span>
      </div>
    </div>
  );
};
