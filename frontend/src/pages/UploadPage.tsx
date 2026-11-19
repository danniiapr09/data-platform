import React from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/common/Button';

export const UploadPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Halaman */}
      <div>
        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Unggah & Profiling Awal Dataset
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Tambahkan berkas data CSV atau Excel untuk pemeriksaan skema otomatis dan deteksi tipe data.
        </p>
      </div>

      {/* Zona Unggah Placeholder */}
      <div className="p-10 rounded-card border-2 border-dashed border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark mx-auto flex items-center justify-center">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Area Unggah Berkas (Fase 1: Kerangka Tata Letak)
          </p>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">
            Mendukung format UTF-8 CSV dan Microsoft Excel (.xlsx, .xls) hingga batas 10 MB.
          </p>
        </div>
        <div className="pt-2">
          <Button variant="secondary" disabled>
            Pilih Berkas Komputer (Aktif di Fase 2)
          </Button>
        </div>
      </div>

      {/* Rincian Ketentuan Validasi */}
      <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
        <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Standar Integritas Data Kedinasan:
        </h3>
        <ul className="text-sm text-text-secondary-light dark:text-text-secondary-dark space-y-1.5">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
            <span>Pemeriksaan skema dan tipe data otomatis tanpa mengubah data mentah asli (v0).</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
            <span>Deteksi nilai kosong dan duplikasi baris disajikan pada tahap review berikutnya.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
