import React from 'react';
import { BarChart2, PieChart, LineChart, Grid } from 'lucide-react';

export const AnalyticsTab: React.FC = () => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Tab 3 */}
      <div>
        <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
          Tab 3: Dashboard Analitik & Galeri Visualisasi Data
        </h2>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
          Eksplorasi data analitis melalui ringkasan 5 angka, korelasi numerik, tren deret waktu, komparasi kategori, dan galeri diagram adaptif.
        </p>
      </div>

      {/* Grid Galeri Visualisasi Data (Fase 5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
          <BarChart2 className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark" />
          <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Komparasi Kategori
          </h3>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Grafik batang horizontal untuk peringkat dan distribusi variabel kategorikal.
          </p>
        </div>

        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
          <PieChart className="w-5 h-5 text-brand-cyan" />
          <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Proporsi Indikator
          </h3>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Grafik donat untuk komposisi agregat entitas data instansi.
          </p>
        </div>

        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
          <LineChart className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark" />
          <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Tren Historis Deret Waktu
          </h3>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Grafik garis deret waktu dengan parameter agregasi dinamis.
          </p>
        </div>

        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-2">
          <Grid className="w-5 h-5 text-brand-violet" />
          <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Matriks Intensitas 2D
          </h3>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Heatmap matriks 2D sebaran data antar-wilayah dan tahun.
          </p>
        </div>
      </div>

      {/* Kartu Penampung Galeri Lengkap (Fase 5) */}
      <div className="p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-3">
        <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          Galeri Diagram Adaptif & Panel Pemilih Kolom (Fase 5)
        </h3>
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-xl mx-auto">
          Panel bilah sisi pemilihan kolom reaktif beserta kartu grafik interaktif (didukung Recharts, thumbnail, mode inspeksi layar penuh, dan ekspor PNG/SVG) akan diimplementasikan pada Fase 5.
        </p>
      </div>
    </div>
  );
};
