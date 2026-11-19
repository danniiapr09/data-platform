import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Database,
  FolderOpen,
  PieChart,
  Plus,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import {
  FormatFileBadge,
  ProcessingStatusBadge,
} from '@/components/common/StatusBadge';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import { getDashboardSummary } from '@/services/datasetService';
import {
  formatDateTimeId,
  formatNumberId,
  formatPercentId,
  normalizeJenisLabel,
} from '@/utils/formatters';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: summary,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => getDashboardSummary(queryClient),
  });

  const errorMessage =
    (error as Error & { localizedMessage?: string })?.localizedMessage ||
    'Gagal memuat ringkasan beranda dari server backend.';

  const showCompletenessCard =
    BACKEND_CAPABILITIES.B09_GLOBAL_COMPLETENESS_METRIC &&
    summary?.rata_rata_kelengkapan_persen !== null &&
    summary?.rata_rata_kelengkapan_persen !== undefined;

  const totalDataset = summary?.jumlah_dataset || 0;
  const uploadedCount = summary?.per_status.uploaded || 0;
  const cleanedCount = summary?.per_status.cleaned || 0;
  const forecastedCount = summary?.per_status.forecasted || 0;
  const pendingAnomalies = summary?.anomali_pending || 0;
  const datasetsWithPending = summary?.dataset_dengan_pending || 0;
  const topPendingDataset = summary?.pending_teratas?.[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
            Beranda Eksekutif & Kurasi Data
          </h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Pantau kesehatan dataset, kelengkapan data institusi, dan prioritas verifikasi anomali.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <CheckCircle2 className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
            <span>{isFetching ? 'Menyegarkan data...' : 'Data terkini'}</span>
          </div>
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Segarkan
          </Button>
        </div>
      </div>

      {/* Penanganan Error Koneksi Backend */}
      {isError && (
        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                Gagal Memuat Data Beranda
              </h3>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                {errorMessage}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => refetch()}
          >
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Kartu Metrik Inti F-01 (3 Kartu Inti; Kartu ke-4 hanya bila saklar B-09 aktif & data tersedia) */}
      <div
        className={`grid grid-cols-1 ${
          showCompletenessCard ? 'md:grid-cols-4' : 'md:grid-cols-3'
        } gap-6`}
      >
        {/* Kartu 1: Total Dataset */}
        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
              Total Dataset
            </span>
            <div className="p-2.5 rounded-full bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
              {isLoading ? '-' : formatNumberId(totalDataset, 0)}
            </div>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
              Total berkas dataset terdaftar di katalog
            </p>
          </div>
        </div>

        {/* Kartu 2: Distribusi Status */}
        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
              Distribusi Status
            </span>
            <div className="p-2.5 rounded-full bg-header-light dark:bg-header-dark text-brand-cyan">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-numbers">
              <span className="px-2.5 py-1 rounded-full bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                Uploaded {isLoading ? '-' : formatNumberId(uploadedCount, 0)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                Cleaned {isLoading ? '-' : formatNumberId(cleanedCount, 0)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-brand-cyan/15 text-brand-primary-light dark:text-brand-primary-dark">
                Forecasted {isLoading ? '-' : formatNumberId(forecastedCount, 0)}
              </span>
            </div>
            {/* Bar Proporsi Status */}
            <div className="w-full h-2 rounded-full bg-header-light dark:bg-header-dark overflow-hidden flex">
              {totalDataset > 0 && (
                <>
                  <div
                    className="h-full bg-anomaly-warning-text-light dark:bg-anomaly-warning-text-dark"
                    style={{ width: `${(uploadedCount / totalDataset) * 100}%` }}
                  />
                  <div
                    className="h-full bg-anomaly-success-text-light dark:bg-anomaly-success-text-dark"
                    style={{ width: `${(cleanedCount / totalDataset) * 100}%` }}
                  />
                  <div
                    className="h-full bg-brand-primary-light dark:bg-brand-primary-dark"
                    style={{ width: `${(forecastedCount / totalDataset) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Kartu 3: Anomali Pending */}
        <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
              Anomali Pending
            </span>
            <div className="p-2.5 rounded-full bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-numbers text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                {isLoading ? '-' : formatNumberId(pendingAnomalies, 0)}
              </span>
              {pendingAnomalies > 0 && (
                <span className="text-xs font-semibold text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                  Perlu verifikasi segera
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
              {pendingAnomalies > 0
                ? `Tersebar di ${formatNumberId(datasetsWithPending, 0)} dataset`
                : 'Tidak ada anomali berstatus pending'}
            </p>
          </div>
        </div>

        {/* Kartu 4: Rata-rata Kelengkapan Data (Hanya tampil jika B-09 aktif & data tersedia) */}
        {showCompletenessCard && (
          <div className="p-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                Rata-rata Kelengkapan Data
              </span>
              <div className="p-2.5 rounded-full bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                {formatPercentId(summary?.rata_rata_kelengkapan_persen)}
              </div>
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                Skor kelengkapan agregat seluruh dataset bersih
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Banner Tindakan Kurasi Diperlukan (Tetap ada sesuai aturan; tombol membuka dataset anomali pending terbanyak di Tab Review Anomali) */}
      <div className="p-5 rounded-card bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light/25 dark:border-anomaly-warning-text-dark/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-3xl">
          <div className="p-2.5 rounded-button bg-surface-light dark:bg-surface-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark flex-shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
              Tindakan Kurasi Diperlukan
            </h3>
            <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-0.5">
              {pendingAnomalies > 0 ? (
                <>
                  Terdapat{' '}
                  <strong className="tabular-numbers font-bold">
                    {formatNumberId(pendingAnomalies, 0)} anomali belum diverifikasi
                  </strong>{' '}
                  pada{' '}
                  <strong className="tabular-numbers font-bold">
                    {formatNumberId(datasetsWithPending, 0)} dataset
                  </strong>
                  . Tinjau dan perbaiki sel anomali untuk memastikan integritas dan akurasi model peramalan statistik.
                </>
              ) : totalDataset === 0 ? (
                'Belum ada dataset terdaftar di sistem. Unggah dataset pertama Anda untuk memulai pemeriksaan skema dan kurasi anomali.'
              ) : (
                'Saat ini tidak terdapat anomali berstatus pending yang menunggu verifikasi. Anda dapat memilih dataset di katalog untuk menjalankan pembersihan atau analisis.'
              )}
            </p>
          </div>
        </div>

        <div>
          {topPendingDataset ? (
            <Button
              variant="primary"
              onClick={() =>
                navigate(
                  `/workspace/${topPendingDataset.dataset_id}/review-anomali`
                )
              }
            >
              Mulai Review Anomali Massal
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() =>
                navigate(totalDataset === 0 ? '/unggah' : '/katalog')
              }
            >
              {totalDataset === 0 ? 'Unggah Dataset Baru' : 'Buka Katalog Dataset'}
            </Button>
          )}
        </div>
      </div>

      {/* Kondisi Kosong (Empty State) jika belum ada dataset sama sekali */}
      {!isLoading && !isError && totalDataset === 0 ? (
        <div className="p-12 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark mx-auto flex items-center justify-center">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              Belum Ada Dataset Terdaftar
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Unggah berkas data CSV atau Excel pertama Anda untuk melihat ringkasan kualitas, struktur skema kolom, dan deteksi anomali.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/unggah')}
            >
              Unggah Dataset Pertama
            </Button>
          </div>
        </div>
      ) : (
        /* Tabel F-02: 5 Dataset dengan Anomali Pending Terbanyak */
        <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
          <div className="p-5 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
                  5 Dataset dengan Anomali Pending Terbanyak
                </h3>
                {pendingAnomalies > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                    Prioritas Tinggi
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                Dataset dengan tingkat inkonsistensi tertinggi yang memerlukan tindak lanjut sebelum tahap peramalan.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/katalog')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary-light dark:text-brand-primary-dark hover:underline min-h-control px-2"
            >
              <span>
                Lihat Semua Dataset ({formatNumberId(totalDataset, 0)})
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-sm text-text-muted-light dark:text-text-muted-dark">
              Memuat daftar prioritas anomali...
            </div>
          ) : !summary?.pending_teratas || summary.pending_teratas.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Tidak ada dataset dengan anomali berstatus pending saat ini.
              </p>
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark max-w-md mx-auto">
                Dataset yang baru diunggah (berstatus Uploaded) perlu dijalankan pembersihan terlebih dahulu di Workspace agar deteksi anomali diproses.
              </p>
              <div className="pt-1">
                <Button variant="secondary" onClick={() => navigate('/katalog')}>
                  Lihat Katalog Dataset
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0">
                    <th className="py-3.5 px-5">Nama Dataset</th>
                    <th className="py-3.5 px-4">Jenis Data</th>
                    <th className="py-3.5 px-4">Status Pemrosesan</th>
                    <th className="py-3.5 px-4">Jumlah Anomali Pending</th>
                    <th className="py-3.5 px-4">Tanggal Unggah</th>
                    <th className="py-3.5 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                  {summary.pending_teratas.map((item) => (
                    <tr
                      key={item.dataset_id}
                      className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0" />
                          <span className="font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                            {item.nama}
                          </span>
                          <FormatFileBadge namaDataset={item.nama} />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark">
                          {item.jenis ? normalizeJenisLabel(item.jenis) : '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.status ? (
                          <ProcessingStatusBadge status={item.status} />
                        ) : (
                          <span className="text-text-muted-light dark:text-text-muted-dark">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-numbers bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{formatNumberId(item.pending, 0)} Anomali</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark">
                        {formatDateTimeId(item.uploaded_at)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            navigate(
                              `/workspace/${item.dataset_id}/review-anomali`
                            )
                          }
                        >
                          Buka Workspace
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 bg-header-light/40 dark:bg-header-dark/40 border-t border-border-light dark:border-border-dark flex items-center justify-between text-xs text-text-muted-light dark:text-text-muted-dark">
            <span className="tabular-numbers">
              Menampilkan {formatNumberId(summary?.pending_teratas?.length || 0, 0)}{' '}
              dari {formatNumberId(totalDataset, 0)} dataset terdaftar dalam katalog
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
