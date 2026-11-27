import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns,
  Database,
  Download,
  Edit3,
  History,
  ShieldCheck,
  Table,
  TrendingUp,
} from 'lucide-react';
import { WorkspaceOutletContext } from '@/layouts/WorkspaceLayout';
import { useWorkspaceTabState } from '@/context/WorkspaceTabStateContext';
import { Button } from '@/components/common/Button';
import { ProcessingTimelineCard } from '@/components/common/ProcessingTimelineList';
import { DataTypeBadge, FormatFileBadge } from '@/components/common/StatusBadge';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import {
  getCleanDataPreview,
  getCleanReport,
  getDatasetColumnDictionary,
  getDatasetHistory,
  getDatasetPreview,
  getExportCsvUrl,
} from '@/services/datasetService';
import { ColumnProfileItem } from '@/types/dataset';
import {
  formatCellValueId,
  formatNumberId,
  formatPercentId,
} from '@/utils/formatters';

interface AccessibleCsvExportButtonProps {
  datasetId: string;
  versionType: 'raw' | 'clean';
  label: string;
  tooltipId: string;
}

/**
 * Tombol ekspor CSV yang mematuhi saklar B-10.
 * Saat B-10 false: memakai aria-disabled="true" (tetap dapat difokus dengan keyboard Tab)
 * dan menampilkan tooltip baik saat hover mouse maupun fokus keyboard.
 */
const AccessibleCsvExportButton: React.FC<AccessibleCsvExportButtonProps> = ({
  datasetId,
  versionType,
  label,
  tooltipId,
}) => {
  const exportUrl = getExportCsvUrl(datasetId, versionType);
  const isEnabled =
    BACKEND_CAPABILITIES.B10_FULL_CSV_EXPORT_ENDPOINT && Boolean(exportUrl);

  if (isEnabled && exportUrl) {
    return (
      <a
        href={exportUrl}
        download
        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-control"
      >
        <Download className="w-4 h-4" />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <div className="relative group inline-block">
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={tooltipId}
        onClick={(e) => e.preventDefault()}
        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-muted-light dark:text-text-secondary-dark opacity-70 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
      >
        <Download className="w-4 h-4" />
        <span>{label}</span>
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-popover bg-surface-dark text-text-primary-dark border border-border-dark text-xs font-medium whitespace-nowrap z-30 shadow-lg pointer-events-none"
      >
        Fitur ekspor CSV penuh belum tersedia pada server saat ini.
      </div>
    </div>
  );
};

interface SchemaRowView {
  kolom: string;
  tipe: string;
  kosongText: string;
  hasMissing: boolean;
  unikText: string;
  contohText: string;
  deskripsiText: string;
}

export const DataStructureTab: React.FC = () => {
  const { datasetId: routeDatasetId = '' } = useParams<{ datasetId: string }>();
  const { dataset, isLoading: isDatasetLoading } =
    useOutletContext<WorkspaceOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const datasetId = String(dataset?.id || routeDatasetId);
  const hasCleanVersion =
    dataset !== undefined &&
    dataset.versi_bersih !== null &&
    dataset.versi_bersih !== undefined;

  const { state: tabMemory, updateTab1 } = useWorkspaceTabState();

  // Toggle versi data yang sedang diinspeksi: 'raw' (v0) atau 'clean' (v{versi})
  const [selectedVersion, setSelectedVersion] = useState<'raw' | 'clean'>(
    () => tabMemory.tab1.selectedVersion ?? 'raw'
  );
  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(
    () => tabMemory.tab1.isAccordionOpen ?? true
  );
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'preview' | 'history'>(
    () => tabMemory.tab1.activeSubTab ?? 'all'
  );

  // Set default toggle ke 'clean' jika belum ada pilihan tersimpan di memori sesi
  useEffect(() => {
    if (dataset && !tabMemory.tab1.selectedVersion) {
      if (dataset.versi_bersih !== null) {
        setSelectedVersion('clean');
      } else {
        setSelectedVersion('raw');
      }
    }
  }, [dataset?.id, dataset?.versi_bersih, tabMemory.tab1.selectedVersion]);

  useEffect(() => {
    updateTab1({ selectedVersion, isAccordionOpen, activeSubTab });
  }, [selectedVersion, isAccordionOpen, activeSubTab, updateTab1]);

  // Query pratinjau data mentah (v0)
  const {
    data: rawPreviewData,
    isLoading: isRawPreviewLoading,
    isError: isRawPreviewError,
    refetch: refetchRawPreview,
  } = useQuery({
    queryKey: ['dataset-preview', datasetId],
    queryFn: () => getDatasetPreview(datasetId, 10),
    enabled: Boolean(datasetId),
  });

  // Query pratinjau data bersih (v{versi}) - hanya dipanggil jika sudah pernah di-cleaning
  const {
    data: cleanPreviewData,
    isLoading: isCleanPreviewLoading,
    isError: isCleanPreviewError,
    refetch: refetchCleanPreview,
  } = useQuery({
    queryKey: ['dataset-clean-preview', datasetId],
    queryFn: () => getCleanDataPreview(datasetId, 10),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  // Query laporan hasil pembersihan (clean-report) - hanya dipanggil jika sudah pernah di-cleaning
  const { data: cleanReport } = useQuery({
    queryKey: ['dataset-clean-report', datasetId],
    queryFn: () => getCleanReport(datasetId),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  // Query linimasa riwayat pemrosesan (history)
  const { data: historyLogs = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['dataset-history', datasetId],
    queryFn: () => getDatasetHistory(datasetId),
    enabled: Boolean(datasetId),
  });

  // Query kamus data kolom permanen di balik saklar B-03
  const { data: columnDictionary } = useQuery({
    queryKey: ['dataset-column-dictionary', datasetId],
    queryFn: () => getDatasetColumnDictionary(datasetId),
    enabled:
      Boolean(datasetId) &&
      BACKEND_CAPABILITIES.B03_COLUMN_DICTIONARY_ENDPOINT,
  });

  // Profil kolom data mentah (v0) dari cache memori React Query saat baru diunggah
  const cachedRawUploadProfile = queryClient.getQueryData<ColumnProfileItem[]>([
    'dataset-upload-profile',
    datasetId,
  ]);

  // Baris pratinjau sesuai toggle versi yang dipilih (tanpa mencampur versi)
  const activePreviewRows = useMemo(() => {
    if (selectedVersion === 'clean') {
      return cleanPreviewData?.preview || [];
    }
    return rawPreviewData?.preview || [];
  }, [selectedVersion, cleanPreviewData, rawPreviewData]);

  // Daftar kolom tabel pratinjau
  const previewColumnNames = useMemo(() => {
    if (activePreviewRows.length > 0) {
      return Object.keys(activePreviewRows[0]);
    }
    if (selectedVersion === 'raw' && cachedRawUploadProfile) {
      return cachedRawUploadProfile.map((c) => c.kolom);
    }
    return [];
  }, [activePreviewRows, selectedVersion, cachedRawUploadProfile]);

  /**
   * Penyusunan baris Tabel Struktur Skema Kolom (F-33).
   * Aturan wajib:
   * - Profil hasil upload HANYA dipakai pada toggle Data Mentah (v0).
   * - Pada toggle Data Bersih (v{versi}), gunakan data clean-report (kosong_per_kolom)
   *   dan '-' untuk nilai unik / deskripsi yang tidak tersedia.
   * - Jangan mencampur angka dua versi dalam satu tabel.
   */
  const schemaRows: SchemaRowView[] = useMemo(() => {
    // 1. Jika saklar B-03 aktif dan endpoint mengembalikan kamus kolom
    if (
      BACKEND_CAPABILITIES.B03_COLUMN_DICTIONARY_ENDPOINT &&
      columnDictionary?.kolom
    ) {
      return columnDictionary.kolom.map((col) => ({
        kolom: col.kolom,
        tipe: col.tipe,
        kosongText: `${formatNumberId(col.kosong, 0)} kosong`,
        hasMissing: col.kosong > 0,
        unikText: formatNumberId(col.unik, 0),
        contohText:
          col.contoh && col.contoh.length > 0
            ? col.contoh.slice(0, 3).join(', ')
            : '-',
        deskripsiText: col.deskripsi || '-',
      }));
    }

    // 2. Toggle Data Mentah (v0)
    if (selectedVersion === 'raw') {
      if (cachedRawUploadProfile && cachedRawUploadProfile.length > 0) {
        return cachedRawUploadProfile.map((col) => ({
          kolom: col.kolom,
          tipe: col.tipe,
          kosongText: `${formatNumberId(col.kosong, 0)} kosong`,
          hasMissing: col.kosong > 0,
          unikText: formatNumberId(col.unik, 0),
          contohText:
            col.contoh && col.contoh.length > 0
              ? col.contoh.slice(0, 3).join(', ')
              : '-',
          deskripsiText: '-', // TODO(B-03): Kamus data kolom dari backend
        }));
      }

      // Fallback Data Mentah jika halaman di-refresh (cache upload memori tidak ada)
      const rawRows = rawPreviewData?.preview || [];
      const colNames = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
      return colNames.map((colName) => {
        const samples: string[] = [];
        let inferredType = 'text';

        for (const r of rawRows) {
          const val = r[colName];
          if (val !== null && val !== undefined && val !== '') {
            if (samples.length < 3) {
              samples.push(formatCellValueId(val));
            }
            if (typeof val === 'number') {
              inferredType = Number.isInteger(val) ? 'integer' : 'decimal';
            }
          }
        }

        return {
          kolom: colName,
          tipe: inferredType,
          kosongText: '-', // Tidak menebak total kosong dari sampel 10 baris
          hasMissing: false,
          unikText: '-', // Tidak menebak total unik dari sampel 10 baris
          contohText: samples.length > 0 ? samples.join(', ') : '-',
          deskripsiText: '-', // TODO(B-03)
        };
      });
    }

    // 3. Toggle Data Bersih Terkini (v{versi})
    const cleanRows = cleanPreviewData?.preview || [];
    const colNames = cleanRows.length > 0 ? Object.keys(cleanRows[0]) : [];
    const convertedCols = new Set(cleanReport?.kolom_diubah_ke_numerik || []);

    return colNames.map((colName) => {
      const samples: string[] = [];
      let inferredType = convertedCols.has(colName) ? 'decimal' : 'text';

      for (const r of cleanRows) {
        const val = r[colName];
        if (val !== null && val !== undefined && val !== '') {
          if (samples.length < 3) {
            samples.push(formatCellValueId(val));
          }
          if (typeof val === 'number') {
            inferredType = Number.isInteger(val) ? 'integer' : 'decimal';
          }
        }
      }

      const hasCleanReport = cleanReport !== undefined;
      const missingCount = hasCleanReport
        ? cleanReport.kosong_per_kolom?.[colName] ?? 0
        : null;

      return {
        kolom: colName,
        tipe: inferredType,
        kosongText:
          missingCount !== null
            ? `${formatNumberId(missingCount, 0)} kosong`
            : '-',
        hasMissing: missingCount !== null && missingCount > 0,
        unikText: '-', // clean-report tidak memuat nilai unik per kolom (TODO: B-03)
        contohText: samples.length > 0 ? samples.join(', ') : '-',
        deskripsiText: '-', // TODO(B-03)
      };
    });
  }, [
    columnDictionary,
    selectedVersion,
    cachedRawUploadProfile,
    rawPreviewData,
    cleanPreviewData,
    cleanReport,
  ]);

  const totalAnomaliesCount = useMemo(() => {
    if (!dataset || dataset.status === 'uploaded') return null;
    return Object.values(dataset.anomali || {}).reduce((acc, n) => acc + n, 0);
  }, [dataset]);

  const activeRowCount =
    selectedVersion === 'clean' && hasCleanVersion
      ? dataset?.baris_bersih ?? 0
      : dataset?.baris_mentah ?? rawPreviewData?.total_baris ?? 0;

  if (isDatasetLoading) {
    return (
      <div className="p-12 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
        Memuat struktur dan ringkasan kualitas dataset...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Kartu Ringkasan Kualitas Data (F-09 - Dipindahkan ke Tab 1 sesuai PRD Revisi 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* 1. Baris Mentah vs Bersih */}
        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
            <span>Baris Mentah vs Bersih</span>
            <Database className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
          </div>
          <div className="text-lg font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
            {formatNumberId(dataset?.baris_mentah, 0)}{' '}
            <span className="text-xs font-normal text-text-muted-light dark:text-text-secondary-dark">
              mentah
            </span>{' '}
            /{' '}
            {hasCleanVersion ? (
              <span>{formatNumberId(dataset?.baris_bersih, 0)}</span>
            ) : (
              <span className="text-sm font-normal text-text-muted-light dark:text-text-secondary-dark">
                -
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted-light dark:text-text-secondary-dark">
            {hasCleanVersion
              ? `Versi aktif: v${dataset?.versi_bersih}`
              : 'Belum dijalankan pembersihan'}
          </p>
        </div>

        {/* 2. Kelengkapan Data */}
        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
            <span>Kelengkapan Data</span>
            <ShieldCheck className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
          </div>
          <div className="text-lg font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
            {hasCleanVersion && cleanReport
              ? formatPercentId(cleanReport.kelengkapan_persen)
              : '-'}
          </div>
          <p className="text-xs text-text-muted-light dark:text-text-secondary-dark">
            {hasCleanVersion
              ? 'Persentase sel terisi pada data bersih'
              : 'Tersedia setelah pembersihan'}
          </p>
        </div>

        {/* 3. Jumlah Anomali */}
        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
            <span>Jumlah Anomali</span>
            <AlertTriangle className="w-4 h-4 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark" />
          </div>
          <div className="text-lg font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
            {dataset?.status === 'uploaded' ? (
              <span className="text-sm font-medium text-text-muted-light dark:text-text-secondary-dark italic">
                Belum diproses
              </span>
            ) : (
              formatNumberId(totalAnomaliesCount, 0)
            )}
          </div>
          <p className="text-xs text-text-muted-light dark:text-text-secondary-dark tabular-numbers">
            {dataset?.status === 'uploaded'
              ? 'Anomali dideteksi saat pembersihan'
              : `${formatNumberId(dataset?.anomali?.pending || 0, 0)} pending • ${formatNumberId(
                  dataset?.anomali?.diterima || 0,
                  0
                )} diterima`}
          </p>
        </div>

        {/* 4. Jumlah Edit Manual */}
        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
            <span>Jumlah Edit Manual</span>
            <Edit3 className="w-4 h-4 text-modified-border-light dark:text-modified-border-dark" />
          </div>
          <div className="text-lg font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
            {formatNumberId(dataset?.jumlah_edit_manual || 0, 0)}
          </div>
          <p className="text-xs text-text-muted-light dark:text-text-secondary-dark">
            Total koreksi sel tercatat di audit log
          </p>
        </div>

        {/* 5. Status Peramalan */}
        <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
            <span>Status Peramalan</span>
            <TrendingUp className="w-4 h-4 text-brand-cyan" />
          </div>
          <div className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            {dataset?.ada_forecast ? (
              <span className="text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                Tersedia
              </span>
            ) : (
              <span className="text-sm font-medium text-text-muted-light dark:text-text-secondary-dark">
                Belum Ada
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted-light dark:text-text-secondary-dark">
            {dataset?.ada_forecast
              ? 'Hasil model proyeksi tersimpan'
              : 'Dapat dijalankan pada Tab 4'}
          </p>
        </div>
      </div>

      {/* Barisan Chip Ringkasan Metrik & Toggle Versi Data Mentah (v0) vs Data Bersih (F-33) */}
      <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
            Total Baris:{' '}
            <strong className="font-mono text-text-primary-light dark:text-text-primary-dark">
              {formatNumberId(activeRowCount, 0)}
            </strong>
          </span>

          <span className="px-3 py-1.5 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
            Total Kolom:{' '}
            <strong className="font-mono text-text-primary-light dark:text-text-primary-dark">
              {formatNumberId(schemaRows.length || previewColumnNames.length, 0)}
            </strong>
          </span>

          {/* Ukuran File: tampil '-' sampai B-08 tersedia */}
          <span className="px-3 py-1.5 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
            Ukuran File:{' '}
            <strong className="font-mono text-text-primary-light dark:text-text-primary-dark">
              -
            </strong>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {selectedVersion === 'clean' && hasCleanVersion
                ? `Versi Aktif: v${dataset?.versi_bersih} (Data Bersih)`
                : 'Versi Aktif: v0 (Data Mentah)'}
            </span>
          </span>
        </div>

        {/* Toggle Penampil Data Mentah (v0) vs Data Bersih Terkini (v{versi}) */}
        <div
          className="inline-flex p-1 rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark"
          role="group"
          aria-label="Pilih versi data untuk diinspeksi"
        >
          <button
            type="button"
            aria-pressed={selectedVersion === 'raw'}
            onClick={() => setSelectedVersion('raw')}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-button transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
              selectedVersion === 'raw'
                ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark shadow-sm'
                : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
            }`}
          >
            Data Mentah (v0)
          </button>
          <div className="relative group inline-flex">
            <button
              type="button"
              aria-pressed={selectedVersion === 'clean' && hasCleanVersion}
              aria-disabled={!hasCleanVersion}
              aria-describedby={!hasCleanVersion ? 'clean-version-unavailable-tip' : undefined}
              onClick={() => {
                if (hasCleanVersion) {
                  setSelectedVersion('clean');
                }
              }}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-button transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
                !hasCleanVersion
                  ? 'opacity-55 cursor-not-allowed text-text-secondary-light dark:text-text-secondary-dark'
                  : selectedVersion === 'clean'
                  ? 'bg-surface-light dark:bg-surface-dark text-brand-primary-light dark:text-brand-primary-dark shadow-sm'
                  : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
              }`}
            >
              {hasCleanVersion
                ? `Data Bersih Terkini (v${dataset?.versi_bersih})`
                : 'Data Bersih (Belum Tersedia)'}
            </button>
            {!hasCleanVersion && (
              <div
                id="clean-version-unavailable-tip"
                role="tooltip"
                className="pointer-events-none absolute right-0 bottom-full mb-2 z-30 w-64 px-3 py-2 rounded-popover text-xs font-medium shadow-lg bg-text-primary-light text-surface-light dark:bg-surface-dark dark:text-text-primary-dark dark:border dark:border-brand-primary-dark opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity"
              >
                Dataset belum melalui proses pembersihan otomatis di Tab 2.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Navigasi Bagian Tab 1 */}
      <div
        role="tablist"
        aria-label="Bagian Tab Data dan Struktur"
        className="flex flex-wrap items-center gap-2 border-b border-border-light dark:border-border-dark"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'all'}
          onClick={() => setActiveSubTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
            activeSubTab === 'all'
              ? 'border-brand-primary-light dark:border-brand-primary-dark text-brand-primary-light dark:text-brand-primary-dark'
              : 'border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
          }`}
        >
          <Columns className="w-4 h-4" aria-hidden="true" />
          <span>Struktur Tabel & Skema Kolom</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'preview'}
          onClick={() => setActiveSubTab('preview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
            activeSubTab === 'preview'
              ? 'border-brand-primary-light dark:border-brand-primary-dark text-brand-primary-light dark:text-brand-primary-dark'
              : 'border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
          }`}
        >
          <Table className="w-4 h-4" aria-hidden="true" />
          <span>Pratinjau Tabel Data</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'history'}
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors min-h-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary-light dark:focus-visible:ring-brand-primary-dark ${
            activeSubTab === 'history'
              ? 'border-brand-primary-light dark:border-brand-primary-dark text-brand-primary-light dark:text-brand-primary-dark'
              : 'border-transparent text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
          }`}
        >
          <History className="w-4 h-4" aria-hidden="true" />
          <span>
            Linimasa Aktivitas ({formatNumberId(historyLogs.length, 0)})
          </span>
        </button>
      </div>

      {/* BAGIAN 1: Struktur Tabel & Skema Kolom */}
      {activeSubTab === 'all' && (
        <div className="rounded-accordion bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
          {/* Header Accordion Skema */}
          <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-border-light dark:border-border-dark">
            <div className="flex flex-wrap items-center gap-2.5">
              <Table className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark" />
              <span className="font-mono font-bold text-sm text-text-primary-light dark:text-text-primary-dark">
                {dataset?.nama || '-'}
              </span>
              <FormatFileBadge namaDataset={dataset?.nama} />
              <span className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                • {formatNumberId(activeRowCount, 0)} baris •{' '}
                {formatNumberId(schemaRows.length, 0)} kolom
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsAccordionOpen((prev) => !prev)}
              aria-expanded={isAccordionOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark min-h-control"
            >
              <span>{isAccordionOpen ? 'Tutup Skema' : 'Buka Skema'}</span>
              {isAccordionOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Tabel 6 Kolom Skema Struktur Dataset */}
          {isAccordionOpen && (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse" aria-label="Tabel Skema Struktur Kolom Dataset">
                <thead>
                  <tr className="bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-primary-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider sticky top-0 z-10">
                    <th scope="col" className="py-3.5 px-5">Kolom</th>
                    <th scope="col" className="py-3.5 px-4">Tipe</th>
                    <th scope="col" className="py-3.5 px-4">Sel Kosong</th>
                    <th scope="col" className="py-3.5 px-4">Nilai Unik</th>
                    <th scope="col" className="py-3.5 px-4">Contoh Nilai</th>
                    <th scope="col" className="py-3.5 px-5">Deskripsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                  {schemaRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark"
                      >
                        {(selectedVersion === 'raw' && isRawPreviewError) ||
                        (selectedVersion === 'clean' && isCleanPreviewError) ? (
                          <div className="space-y-2">
                            <p className="text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark font-medium">
                              Gagal memuat skema kolom dataset dari server.
                            </p>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                selectedVersion === 'raw'
                                  ? refetchRawPreview()
                                  : refetchCleanPreview()
                              }
                            >
                              Coba Lagi
                            </Button>
                          </div>
                        ) : (selectedVersion === 'raw' && isRawPreviewLoading) ||
                          (selectedVersion === 'clean' && isCleanPreviewLoading) ? (
                          'Memuat skema kolom...'
                        ) : (
                          'Belum ada skema kolom yang dapat ditampilkan.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    schemaRows.map((row) => (
                      <tr
                        key={row.kolom}
                        className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-text-primary-light dark:text-text-primary-dark">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary-light dark:bg-brand-primary-dark" />
                            <span>{row.kolom}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <DataTypeBadge rawType={row.tipe} />
                        </td>
                        <td className="py-3.5 px-4 font-mono text-sm tabular-numbers">
                          {row.kosongText === '-' ? (
                            <span className="text-text-secondary-light dark:text-text-secondary-dark">
                              -
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                row.hasMissing
                                  ? 'bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark'
                                  : 'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark'
                              }`}
                            >
                              {row.kosongText}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-sm tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                          {row.unikText}
                        </td>
                        <td
                          className="py-3.5 px-4 font-mono text-sm text-text-secondary-light dark:text-text-secondary-dark max-w-xs truncate"
                          title={row.contohText}
                        >
                          {row.contohText}
                        </td>
                        <td className="py-3.5 px-5 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                          {row.deskripsiText}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BAGIAN 2: Pratinjau Tabel Data (10 Baris dari Versi Aktif) */}
      {(activeSubTab === 'all' || activeSubTab === 'preview') && (
        <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
          <div className="p-4 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Table className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark" />
              <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                {selectedVersion === 'clean' && hasCleanVersion
                  ? `Pratinjau Data Bersih v${dataset?.versi_bersih}`
                  : 'Pratinjau Data Mentah v0'}{' '}
                <span className="font-normal text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                  ({formatNumberId(activePreviewRows.length, 0)} dari{' '}
                  {formatNumberId(activeRowCount, 0)} Baris)
                </span>
              </h3>
              {selectedVersion === 'clean' && hasCleanVersion && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Data Bersih Terkini</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1.5 rounded-button bg-header-light dark:bg-header-dark text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Format Angka Baku: Indonesia (Titik Ribuan, Koma Desimal)
              </span>

              <AccessibleCsvExportButton
                datasetId={datasetId}
                versionType={selectedVersion}
                label="Ekspor CSV Cepat"
                tooltipId="tooltip-ekspor-csv-cepat"
              />
            </div>
          </div>

          {/* Tabel Pratinjau 10 Baris */}
          {(selectedVersion === 'raw' && isRawPreviewError) ||
          (selectedVersion === 'clean' && isCleanPreviewError) ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                Gagal memuat pratinjau baris data dari server.
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  selectedVersion === 'raw'
                    ? refetchRawPreview()
                    : refetchCleanPreview()
                }
              >
                Coba Lagi
              </Button>
            </div>
          ) : (selectedVersion === 'raw' && isRawPreviewLoading) ||
          (selectedVersion === 'clean' && isCleanPreviewLoading) ? (
            <div className="p-10 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
              Memuat baris pratinjau data...
            </div>
          ) : activePreviewRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
              Tidak ada baris pratinjau untuk ditampilkan.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="w-full text-left border-collapse" aria-label="Tabel Pratinjau Baris Data">
                <thead>
                  <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0 z-10">
                    <th scope="col" className="py-3 px-4 w-12 text-center">#</th>
                    {previewColumnNames.map((col) => (
                      <th key={col} scope="col" className="py-3 px-4 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
                  {activePreviewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        {idx + 1}
                      </td>
                      {previewColumnNames.map((col) => (
                        <td
                          key={col}
                          className="py-2.5 px-4 text-text-primary-light dark:text-text-primary-dark whitespace-nowrap rounded-cell"
                        >
                          {formatCellValueId(row[col], col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Tabel Pratinjau */}
          <div className="px-5 py-3.5 bg-header-light/40 dark:bg-header-dark/40 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
              <CheckCircle2 className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
              <span>
                Menampilkan {formatNumberId(activePreviewRows.length, 0)} dari{' '}
                {formatNumberId(activeRowCount, 0)} baris data
              </span>
            </div>

            <Button
              variant="secondary"
              icon={<ArrowRight className="w-4 h-4" />}
              onClick={() =>
                navigate(`/workspace/${datasetId}/review-anomali`)
              }
            >
              Lihat Seluruh {formatNumberId(activeRowCount, 0)} Baris di Editor
            </Button>
          </div>
        </div>
      )}

      {/* BAGIAN 3: Linimasa Aktivitas Pemrosesan / Audit Trail (F-10) */}
      {(activeSubTab === 'all' || activeSubTab === 'history') && (
        <ProcessingTimelineCard
          historyLogs={historyLogs}
          isLoading={isHistoryLoading}
        />
      )}

      {/* Banner Integritas Non-Destruktif & Tombol Unduh Data Mentah (v0) */}
      <div className="p-4 rounded-card bg-header-light/50 dark:bg-header-dark/50 border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-2xl">
          <ShieldCheck className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark">
              Integritas Non-Destruktif Terjamin
            </h4>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
              Dataset mentah (v0) tetap tersimpan utuh di penyimpanan arsip. Seluruh pembersihan dan kurasi anomali diterapkan pada lapisan versi terpisah.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AccessibleCsvExportButton
            datasetId={datasetId}
            versionType="raw"
            label="Unduh Data Mentah (v0)"
            tooltipId="tooltip-unduh-data-mentah"
          />

          <Button
            variant="primary"
            onClick={() => navigate(`/workspace/${datasetId}/review-anomali`)}
          >
            Buka Review Anomali & Editor
          </Button>
        </div>
      </div>
    </div>
  );
};
