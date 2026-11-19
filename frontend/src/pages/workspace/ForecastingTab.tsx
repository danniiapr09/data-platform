import React from 'react';
import { TrendingUp, FileSpreadsheet, Download, Sliders } from 'lucide-react';
import { Button } from '@/components/common/Button';

export const ForecastingTab: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Tab 4 */}
      <div>
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Tab 4: Peramalan Statistik & Ekspor Berkas Resmi
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Konfigurasi horizon proyeksi 1–24 periode, evaluasi 4 model baseline, visualisasi deret waktu dengan pita keyakinan 95%, dan unduh laporan resmi.
        </p>
      </div>

      {/* Grid Informasi Fitur Peramalan (Fase 6) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-3">
          <div className="flex items-center gap-2 text-brand-primary-light dark:text-brand-primary-dark font-semibold text-sm">
            <Sliders className="w-5 h-5" />
            <span>Horizon Proyeksi & Evaluasi Model (F-26, F-28)</span>
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Mendukung pengaturan rentang peramalan 1–24 periode serta penentuan otomatis model terbaik dari 4 algoritma baseline berdasarkan metrik evaluasi MAE, MAPE, dan RMSE.
          </p>
        </div>

        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-3">
          <div className="flex items-center gap-2 text-brand-cyan font-semibold text-sm">
            <TrendingUp className="w-5 h-5" />
            <span>Grafik Deret Waktu & Pita Keyakinan 95% (F-27)</span>
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Grafik visual deret waktu gabungan (garis solid data historis, garis putus-putus proyeksi, dan pita area keyakinan 95% rgba(14, 165, 233, 0.15)) akan aktif pada Fase 6.
          </p>
        </div>
      </div>

      {/* Zona Ekspor Berkas Resmi (F-30, F-31) */}
      <div className="p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          <FileSpreadsheet className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
          <span>Ekspor Berkas Kedinasan Resmi (F-30, F-31)</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon={<Download className="w-4 h-4" />} disabled>
            Unduh Berkas Excel Multi-Sheet (.xlsx)
          </Button>
          <Button variant="secondary" icon={<Download className="w-4 h-4" />} disabled>
            Unduh Hasil Proyeksi (.csv)
          </Button>
          <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
            *Fitur ekspor akan dihubungkan ke endpoint backend pada implementasi Fase 6.
          </span>
        </div>
      </div>
    </div>
  );
};
