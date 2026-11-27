import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import {
  FormatFileBadge,
  ProcessingStatusBadge,
} from '@/components/common/StatusBadge';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getDatasets } from '@/services/datasetService';
import {
  formatDateTimeId,
  formatFileSizeId,
  formatNumberId,
  normalizeJenisLabel,
} from '@/utils/formatters';

export const CatalogPage: React.FC = () => {
  useDocumentTitle('Katalog Dataset');
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [jenisFilter, setJenisFilter] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const {
    data: datasets = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['datasets'],
    queryFn: getDatasets,
  });

  const errorMessage =
    (error as Error & { localizedMessage?: string })?.localizedMessage ||
    'Gagal memuat daftar katalog dataset dari server backend.';

  // Daftar kategori unik yang telah dinormalisasi huruf kapitalnya (Title Case)
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const ds of datasets) {
      set.add(normalizeJenisLabel(ds.jenis));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'));
  }, [datasets]);

  // Penyaringan sisi klien berdasarkan nama, status, dan kategori jenis data
  const filteredDatasets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return datasets.filter((ds) => {
      const normalizedJenis = normalizeJenisLabel(ds.jenis);
      const matchSearch =
        !q ||
        ds.nama.toLowerCase().includes(q) ||
        normalizedJenis.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'ALL' || ds.status.toLowerCase() === statusFilter.toLowerCase();
      const matchJenis =
        jenisFilter === 'ALL' || normalizedJenis === jenisFilter;
      return matchSearch && matchStatus && matchJenis;
    });
  }, [datasets, searchQuery, statusFilter, jenisFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDatasets.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedDatasets = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredDatasets.slice(start, start + pageSize);
  }, [filteredDatasets, safeCurrentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setJenisFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilter =
    searchQuery.trim() !== '' || statusFilter !== 'ALL' || jenisFilter !== 'ALL';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
              Katalog Dataset
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold tabular-numbers bg-brand-primary-light/10 dark:bg-brand-primary-dark/15 text-brand-primary-light dark:text-brand-primary-dark">
              {formatNumberId(datasets.length, 0)} Dataset Terdaftar
            </span>
          </div>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Kelola, tinjau kualitas, dan analisis seluruh dataset terstruktur yang tersimpan di sistem registri.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Segarkan
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/unggah')}
          >
            Unggah Dataset Baru
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
                Gagal Memuat Katalog Dataset
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

      {/* Bilah Pencarian & Filter Sisi Klien (F-05) */}
      <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-secondary-dark" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari nama dataset atau jenis data..."
            aria-label="Cari nama dataset"
            className="w-full pl-10 pr-4 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-status"
              className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Status:
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
            >
              <option value="ALL">
                Semua Status ({formatNumberId(datasets.length, 0)})
              </option>
              <option value="uploaded">Uploaded</option>
              <option value="cleaned">Cleaned</option>
              <option value="forecasted">Forecasted</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-jenis"
              className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Jenis:
            </label>
            <select
              id="filter-jenis"
              value={jenisFilter}
              onChange={(e) => {
                setJenisFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
            >
              <option value="ALL">Semua Kategori</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilter && (
            <Button
              variant="secondary"
              icon={<X className="w-4 h-4" />}
              onClick={handleResetFilters}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Tabel Katalog Dataset (F-04) */}
      {isLoading ? (
        <div className="p-12 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
          Memuat daftar katalog dataset...
        </div>
      ) : !isError && datasets.length === 0 ? (
        /* Kondisi Kosong (Empty State) jika belum ada dataset */
        <div className="p-12 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark mx-auto flex items-center justify-center">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              Katalog Dataset Masih Kosong
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Belum ada berkas data CSV atau Excel yang diunggah ke sistem. Unggah dataset pertama Anda untuk memulai.
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
      ) : filteredDatasets.length === 0 ? (
        <div className="p-10 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-3">
          <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Tidak ada dataset yang cocok dengan pencarian atau filter yang dipilih.
          </p>
          <Button variant="secondary" onClick={handleResetFilters}>
            Reset Pencarian & Filter
          </Button>
        </div>
      ) : (
        <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0">
                  <th className="py-3.5 px-5">Nama Dataset</th>
                  <th className="py-3.5 px-4">Jenis Data</th>
                  <th className="py-3.5 px-4">Dimensi Data</th>
                  <th className="py-3.5 px-4">Status Pemrosesan</th>
                  <th className="py-3.5 px-4">Anomali</th>
                  <th className="py-3.5 px-4">Tanggal Unggah</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                {paginatedDatasets.map((ds) => {
                  const hasExtendedMeta =
                    BACKEND_CAPABILITIES.B08_CATALOG_EXTENDED_METADATA;

                  return (
                    <tr
                      key={ds.id}
                      className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                    >
                      {/* Nama Dataset + Badge Format Berkas (jika berekstensi) */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-button bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0">
                            <Database className="w-4 h-4" />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                              {ds.nama}
                            </span>
                            <FormatFileBadge
                              namaDataset={ds.nama}
                              explicitFormat={hasExtendedMeta ? ds.format : null}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Jenis Data (Kategori Semantik Ter-normalisasi) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark">
                          {normalizeJenisLabel(ds.jenis)}
                        </span>
                      </td>

                      {/* Dimensi Data (Di balik saklar B-08; tampil '-' saat false) */}
                      <td className="py-3.5 px-4 font-mono text-sm text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                        {hasExtendedMeta && ds.jumlah_baris !== undefined ? (
                          <div>
                            <div className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                              {formatNumberId(ds.jumlah_baris, 0)} baris
                            </div>
                            <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                              {formatNumberId(ds.jumlah_kolom, 0)} kolom
                              {ds.file_size_bytes !== undefined
                                ? ` • ${formatFileSizeId(ds.file_size_bytes)}`
                                : ''}
                            </div>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* Status Pemrosesan */}
                      <td className="py-3.5 px-4">
                        <ProcessingStatusBadge status={ds.status} />
                      </td>

                      {/* Status Anomali ('Belum diproses' untuk Uploaded; '-' saat B-08 false) */}
                      <td className="py-3.5 px-4 text-sm">
                        {ds.status === 'uploaded' ? (
                          <span className="text-text-secondary-light dark:text-text-secondary-dark italic">
                            Belum diproses
                          </span>
                        ) : hasExtendedMeta && ds.anomali_pending !== undefined ? (
                          ds.anomali_pending > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold tabular-numbers bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>
                                {formatNumberId(ds.anomali_pending, 0)} Pending
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>0 Bersih</span>
                            </span>
                          )
                        ) : (
                          <span className="font-mono text-text-secondary-light dark:text-text-secondary-dark">
                            -
                          </span>
                        )}
                      </td>

                      {/* Tanggal Unggah */}
                      <td className="py-3.5 px-4 font-mono text-sm text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                        {formatDateTimeId(ds.uploaded_at)}
                      </td>

                      {/* Tombol Aksi Tegas Buka Workspace */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <Button
                          variant="secondary"
                          icon={<ExternalLink className="w-4 h-4" />}
                          onClick={() =>
                            navigate(`/workspace/${ds.id}/data-struktur`)
                          }
                        >
                          Buka Workspace
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Kontrol Paginasi Sisi Klien */}
          <div className="px-5 py-3.5 bg-header-light/40 dark:bg-header-dark/40 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <div className="flex items-center gap-2">
              <label htmlFor="page-size-select">Tampilkan:</label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-sm rounded-input border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark min-h-control"
              >
                <option value={10}>10 baris</option>
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
              </select>
              <span className="tabular-numbers">
                per halaman (Total: {formatNumberId(filteredDatasets.length, 0)}{' '}
                dataset)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                icon={<ChevronLeft className="w-4 h-4" />}
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <span className="px-3 py-1.5 font-mono font-semibold text-sm tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                {formatNumberId(safeCurrentPage, 0)} / {formatNumberId(totalPages, 0)}
              </span>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
