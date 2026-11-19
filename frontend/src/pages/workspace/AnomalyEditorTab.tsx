import React from 'react';
import { Sparkles, Check, AlertTriangle, X, Edit3 } from 'lucide-react';

export const AnomalyEditorTab: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Tab 2 */}
      <div>
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Tab 2: Review Anomali & Editor Terpadu
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Grid data bersih interaktif dengan penanda warna tematik 4 status, aksi verifikasi Terima/Tolak, editor popover inline, dan riwayat audit.
        </p>
      </div>

      {/* Kartu Penjelasan Token Warna Status Anomali Sesuai design-system.md */}
      <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-3">
        <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
          <span>Panduan Token Warna Status Anomali (Sesuai Design System)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-button bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark border border-border-light dark:border-border-dark flex items-center gap-2 text-xs font-semibold">
            <Check className="w-4 h-4" />
            <span>Diterima / Cleaned</span>
          </div>
          <div className="p-3 rounded-button bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark border border-border-light dark:border-border-dark flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4" />
            <span>Pending / Butuh Verifikasi</span>
          </div>
          <div className="p-3 rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark border border-border-light dark:border-border-dark flex items-center gap-2 text-xs font-semibold line-through">
            <X className="w-4 h-4" />
            <span>Ditolak / Dibuang</span>
          </div>
          <div className="p-3 rounded-button bg-modified-bg-light dark:bg-modified-bg-dark text-text-primary-light dark:text-text-primary-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark border-t border-r border-b border-border-light dark:border-border-dark flex items-center gap-2 text-xs font-semibold">
            <Edit3 className="w-4 h-4 text-modified-border-light dark:text-modified-border-dark" />
            <span>Diperbaiki (Edit Manual)</span>
          </div>
        </div>
      </div>

      {/* Kartu Penampung Grid Data Bersih (Fase 3 & 4) */}
      <div className="p-10 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-3">
        <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          Tabel Grid Data Terpadu (Fase 3 & 4: Siap Diterapkan)
        </h3>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-xl mx-auto">
          Komponen tabel data penuh dengan sticky header, aksi 3 serangkai (Terima, Tolak, Edit inline popover dengan alasan minimal 5 karakter), slide-over drawer audit log, serta modal konfirmasi dua langkah Apply Review akan diimplementasikan pada Fase 3 dan Fase 4.
        </p>
      </div>
    </div>
  );
};
