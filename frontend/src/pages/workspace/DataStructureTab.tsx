import React from 'react';
import { Table, ShieldCheck, History } from 'lucide-react';

export const DataStructureTab: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Tab 1 */}
      <div>
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Tab 1: Data & Struktur Skema Kolom
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Tinjau ringkasan kualitas, integritas data mentah vs bersih, dan struktur skema kolom dataset.
        </p>
      </div>

      {/* Grid Kartu Ringkasan Kualitas (F-09) & Linimasa (F-10) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
          <div className="flex items-center gap-2 text-brand-primary-light dark:text-brand-primary-dark font-semibold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Ringkasan Kualitas Data (F-09)</span>
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Komponen metrik baris mentah vs bersih, kelengkapan data, total anomali, dan status peramalan akan dihubungkan ke endpoint <span className="font-mono text-xs">GET /datasets/&#123;id&#125;/clean-report</span> pada Fase 2.
          </p>
        </div>

        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
          <div className="flex items-center gap-2 text-brand-cyan font-semibold text-sm">
            <History className="w-5 h-5" />
            <span>Linimasa Pemrosesan (F-10)</span>
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Linimasa audit trail aktivitas data dari tahap upload, pembersihan otomatis, hingga review kurasi akan dihubungkan ke endpoint <span className="font-mono text-xs">GET /datasets/&#123;id&#125;/history</span> pada Fase 2.
          </p>
        </div>
      </div>

      {/* Kartu Penampung Tabel Struktur Skema Kolom (F-33) */}
      <div className="p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          <Table className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
          <span>Struktur Tabel & Kamus Data Kolom (F-33)</span>
        </div>
        <div className="p-8 rounded-card border border-dashed border-border-light dark:border-border-dark text-center text-sm text-text-muted-light dark:text-text-muted-dark">
          Tabel skema kolom (nama kolom, tipe data, jumlah nilai kosong, nilai unik, contoh nilai, dan deskripsi) akan dimuat secara dinamis pada implementasi Fase 2.
        </div>
      </div>
    </div>
  );
};
