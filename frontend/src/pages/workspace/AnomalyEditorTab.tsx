import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  History,
  Info,
  ListFilter,
  RotateCcw,
  Search,
  Sparkles,
  Table,
  X,
} from 'lucide-react';
import { WorkspaceOutletContext } from '@/layouts/WorkspaceLayout';
import { Button } from '@/components/common/Button';
import { showToast } from '@/components/common/Toast';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import { CleanConflictModal } from '@/components/review/CleanConflictModal';
import { CleanReportPanel } from '@/components/review/CleanReportPanel';
import { InlineCellEditorPopover } from '@/components/review/InlineCellEditorPopover';
import { AuditLogDrawer } from '@/components/review/AuditLogDrawer';
import {
  getAnomalyItems,
  getAnomalySummary,
  getBoundedAnomalyItems,
  getCleanDataPreview,
  getCleanReport,
  getDatasetEdits,
  getDatasetPreview,
  getUnifiedDataReview,
  MAX_ANOMALIES_BATCH_LOAD,
  patchAnomalyStatus,
  patchDatasetCells,
  postBulkAnomalyReview,
  runDatasetCleaning,
} from '@/services/datasetService';
import {
  AnomalyGroupBy,
  AnomalyReviewActionStatus,
  AnomalyStatus,
  CellEditResultItem,
} from '@/types/dataset';
import { formatCellValueId, formatNumberId } from '@/utils/formatters';
import {
  buildVerifiedRowMapping,
  VerifiedCleanRow,
} from '@/utils/rowIndexMapper';

interface BulkFilterConfirmationState {
  status: 'diterima' | 'ditolak';
  jenis: string | null;
  kolom: string | null;
  semua: boolean;
  dariStatus: AnomalyStatus;
  affectedCount: number;
  criteriaDescription: string;
}

export const AnomalyEditorTab: React.FC = () => {
  const { datasetId: routeDatasetId = '' } = useParams<{ datasetId: string }>();
  const { dataset, isLoading: isDatasetLoading } =
    useOutletContext<WorkspaceOutletContext>();
  const queryClient = useQueryClient();

  const datasetId = String(dataset?.id || routeDatasetId);
  const hasCleanVersion =
    dataset !== undefined &&
    dataset.versi_bersih !== null &&
    dataset.versi_bersih !== undefined;

  // State Modal Konflik 409 (?timpa=true)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictDetailMsg, setConflictDetailMsg] = useState<string | null>(
    null
  );

  // State Slide-over Drawer Audit Log (F-20)
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  // State Ringkasan Anomali (F-13)
  const [summaryGroupBy, setSummaryGroupBy] =
    useState<AnomalyGroupBy>('jenis');
  const [summaryDataKolom, setSummaryDataKolom] = useState<string>('');

  // State Filter Tabel & Anomali (F-14)
  const [filterJenis, setFilterJenis] = useState<string | null>(null);
  const [filterKolom, setFilterKolom] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AnomalyStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State Paginasi Grid (50 atau 100 baris per halaman)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // State Paginasi Server-side jika anomali > 2.000
  const [serverAnomalyPage, setServerAnomalyPage] = useState<number>(1);
  const serverAnomalyPageSize = 50;

  // State Checkbox Pilhan Anomali untuk Bulk Review (menyimpan anomaly.id)
  const [selectedAnomalyIds, setSelectedAnomalyIds] = useState<number[]>([]);

  // State Popover Inline Cell Editor (menyimpan anomaly.id yang sedang diedit)
  const [activeEditAnomalyId, setActiveEditAnomalyId] = useState<number | null>(
    null
  );

  // State Banner Hasil Edit Sel Terakhir (nilai_lama -> nilai_baru dari respons PATCH)
  const [lastEditVerification, setLastEditVerification] = useState<{
    versiBaru: number;
    changes: CellEditResultItem[];
  } | null>(null);

  // State Banner Peringatan Stale Forecast dari respons backend
  const [staleForecastWarnings, setStaleForecastWarnings] = useState<string[]>(
    []
  );

  // State Konfirmasi Aksi Massal Berdasarkan Filter (Butir f)
  const [bulkFilterConfirm, setBulkFilterConfirm] =
    useState<BulkFilterConfirmationState | null>(null);

  // Reset halaman ke 1 saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
    setServerAnomalyPage(1);
  }, [filterJenis, filterKolom, filterStatus, searchQuery, pageSize]);

  // 1. Query Laporan Hasil Pembersihan (GET /datasets/{id}/clean-report)
  const { data: cleanReport, isLoading: isCleanReportLoading } = useQuery({
    queryKey: ['dataset-clean-report', datasetId],
    queryFn: () => getCleanReport(datasetId),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  // 2. Query Pratinjau Data Bersih (GET /datasets/{id}/clean-preview?limit=200)
  const { data: cleanPreviewData, isLoading: isCleanPreviewLoading } = useQuery(
    {
      queryKey: ['dataset-clean-preview', datasetId, 200],
      queryFn: () => getCleanDataPreview(datasetId, 200),
      enabled:
        Boolean(datasetId) &&
        hasCleanVersion &&
        !BACKEND_CAPABILITIES.B05_UNIFIED_DATA_REVIEW_ENDPOINT,
    }
  );

  // 3. Query Pratinjau Data Mentah (GET /datasets/{id}/preview?limit=200)
  // Dimuat untuk alignment sekuensial RawData -> CleanData & verifikasi alasan [format]
  const { data: rawPreviewData, isLoading: isRawPreviewLoading } = useQuery({
    queryKey: ['dataset-preview', datasetId, 200],
    queryFn: () => getDatasetPreview(datasetId, 200),
    enabled:
      Boolean(datasetId) &&
      hasCleanVersion &&
      !BACKEND_CAPABILITIES.B05_UNIFIED_DATA_REVIEW_ENDPOINT,
  });

  // 4. Query Item Anomali Terbatas (Maksimal 2.000 item sekaligus sesuai Butir e)
  const {
    data: boundedAnomaliesData,
    isLoading: isAnomaliesLoading,
    isFetching: isAnomaliesFetching,
  } = useQuery({
    queryKey: ['dataset-anomalies-items', datasetId, 'bounded'],
    queryFn: () => getBoundedAnomalyItems(datasetId),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  const isOver2000Anomalies = Boolean(boundedAnomaliesData?.isTruncated);

  // 4b. Query Paginasi Server-side jika total anomali > 2.000
  const {
    data: serverPagedAnomalies,
    isLoading: isServerPagedLoading,
  } = useQuery({
    queryKey: [
      'dataset-anomalies-items',
      datasetId,
      'server-paged',
      filterJenis,
      filterKolom,
      filterStatus,
      serverAnomalyPage,
    ],
    queryFn: () =>
      getAnomalyItems(datasetId, {
        jenis: filterJenis,
        kolom: filterKolom,
        status: filterStatus,
        limit: serverAnomalyPageSize,
        offset: (serverAnomalyPage - 1) * serverAnomalyPageSize,
      }),
    enabled:
      Boolean(datasetId) && hasCleanVersion && isOver2000Anomalies,
  });

  // 5. Query Riwayat Edit Manual (GET /datasets/{id}/edits)
  // Dipakai oleh Drawer Audit Log (F-20) dan uji silang nilai sel yang berstatus 'diperbaiki'
  const {
    data: editsResponse,
    isLoading: isEditsLoading,
    isFetching: isEditsFetching,
    refetch: refetchEdits,
  } = useQuery({
    queryKey: ['dataset-edits', datasetId],
    queryFn: () => getDatasetEdits(datasetId, { limit: 200, offset: 0 }),
    enabled: Boolean(datasetId) && hasCleanVersion,
  });

  // 6. Query Endpoint Terpadu di balik saklar B-05
  const { data: unifiedReviewData } = useQuery({
    queryKey: [
      'dataset-unified-review',
      datasetId,
      currentPage,
      pageSize,
      filterStatus,
      filterJenis,
      filterKolom,
      searchQuery,
    ],
    queryFn: () =>
      getUnifiedDataReview(datasetId, {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        status: filterStatus,
        jenis: filterJenis,
        kolom: filterKolom,
        q: searchQuery || null,
      }),
    enabled:
      Boolean(datasetId) &&
      hasCleanVersion &&
      BACKEND_CAPABILITIES.B05_UNIFIED_DATA_REVIEW_ENDPOINT,
  });

  // Daftar nama kolom dari data bersih
  const availableColumns = useMemo(() => {
    const cleanRows = cleanPreviewData?.preview || [];
    if (cleanRows.length > 0) {
      return Object.keys(cleanRows[0]);
    }
    if (unifiedReviewData && unifiedReviewData.rows.length > 0) {
      return Object.keys(unifiedReviewData.rows[0].data);
    }
    return [];
  }, [cleanPreviewData, unifiedReviewData]);

  // Pilih kolom default untuk group_by='data' jika belum dipilih
  useEffect(() => {
    if (!summaryDataKolom && availableColumns.length > 0) {
      const preferred =
        availableColumns.find(
          (c) =>
            c.includes('wilayah') ||
            c.includes('kota') ||
            c.includes('kab') ||
            c.includes('provinsi') ||
            c.includes('kategori')
        ) || availableColumns[0];
      setSummaryDataKolom(preferred);
    }
  }, [availableColumns, summaryDataKolom]);

  // 7. Query Ringkasan Anomali (GET /datasets/{id}/anomalies/summary)
  const { data: anomalySummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: [
      'dataset-anomalies-summary',
      datasetId,
      summaryGroupBy,
      summaryGroupBy === 'data' ? summaryDataKolom : null,
    ],
    queryFn: () =>
      getAnomalySummary(datasetId, {
        group_by: summaryGroupBy,
        data_kolom: summaryGroupBy === 'data' ? summaryDataKolom : null,
      }),
    enabled:
      Boolean(datasetId) &&
      hasCleanVersion &&
      (summaryGroupBy !== 'data' || Boolean(summaryDataKolom)),
  });

  // Deteksi kolom bertipe numerik untuk validasi klien pada Popover Inline Editor
  const numericColumnsSet = useMemo(() => {
    const set = new Set<string>(cleanReport?.kolom_diubah_ke_numerik || []);
    const cleanRows = cleanPreviewData?.preview || [];
    if (cleanRows.length > 0) {
      const cols = Object.keys(cleanRows[0]);
      for (const col of cols) {
        const nonNullVals = cleanRows
          .map((r) => r[col])
          .filter((v) => v !== null && v !== undefined && v !== '');
        if (
          nonNullVals.length > 0 &&
          nonNullVals.every(
            (v) => typeof v === 'number' && !Number.isNaN(v)
          )
        ) {
          set.add(col);
        }
      }
    }
    return set;
  }, [cleanReport, cleanPreviewData]);

  // PEMETAAN POSISI BARIS KE ROW_INDEX & UJI SILANG ANOMALI (Butir a)
  const rowMapping = useMemo(() => {
    if (!hasCleanVersion || !cleanPreviewData || !boundedAnomaliesData) {
      return null;
    }

    // Jika total anomali > 2.000, pemetaan grid penuh dinonaktifkan dan beralih ke Mode Daftar Anomali Server
    if (boundedAnomaliesData.isTruncated) {
      return {
        isValid: false,
        method: 'failed' as const,
        failureReason: `Dataset memiliki ${formatNumberId(
          boundedAnomaliesData.total,
          0
        )} anomali (melebihi batas pemuatan sekaligus ${formatNumberId(
          MAX_ANOMALIES_BATCH_LOAD,
          0
        )} anomali). Menampilkan Mode Daftar Anomali dengan filter dan paginasi server.`,
        verifiedRows: [],
        rowByRowIndex: {},
      };
    }

    return buildVerifiedRowMapping({
      cleanPreviewRows: cleanPreviewData.preview,
      explicitRowIndices: BACKEND_CAPABILITIES.B04_CLEAN_PREVIEW_ROW_INDEX
        ? cleanPreviewData.row_indices
        : undefined,
      rawPreviewRows: rawPreviewData?.preview,
      barisMentah: cleanReport?.baris_awal ?? dataset?.baris_mentah ?? 0,
      barisBersih: cleanReport?.baris_akhir ?? dataset?.baris_bersih ?? 0,
      duplikatDihapus: cleanReport?.duplikat_dihapus ?? 0,
      jumlahReviewDiterapkan: dataset?.jumlah_review_diterapkan ?? 0,
      kolomDiubahKeNumerik: cleanReport?.kolom_diubah_ke_numerik ?? [],
      anomalies: boundedAnomaliesData.items,
      edits: editsResponse?.data ?? [],
    });
  }, [
    hasCleanVersion,
    cleanPreviewData,
    rawPreviewData,
    cleanReport,
    dataset,
    boundedAnomaliesData,
    editsResponse,
  ]);

  // Helper Penyegaran Seluruh Query Terkait (Tabel, Ringkasan Anomali, Header Workspace, Tab 1, Beranda)
  const invalidateAllRelatedQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['dataset-detail', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-clean-report', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-clean-preview', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-preview', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-anomalies-summary', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-anomalies-items', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-edits', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-history', datasetId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['dataset-unified-review', datasetId],
      }),
      queryClient.invalidateQueries({ queryKey: ['datasets'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
    ]);
  };

  // Mutasi 1: POST /datasets/{id}/clean (dan ?timpa=true)
  const cleanMutation = useMutation({
    mutationFn: (timpa: boolean) => runDatasetCleaning(datasetId, timpa),
    onSuccess: async (res) => {
      setIsConflictModalOpen(false);
      setConflictDetailMsg(null);
      setSelectedAnomalyIds([]);
      setActiveEditAnomalyId(null);
      setLastEditVerification(null);
      await invalidateAllRelatedQueries();
      showToast(
        `Pembersihan otomatis selesai (Versi Bersih v${res.versi}: ${formatNumberId(
          res.laporan.baris_akhir,
          0
        )} baris, ${formatNumberId(
          res.laporan.anomali_total,
          0
        )} anomali terdeteksi).`,
        'success'
      );
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } };
        localizedMessage?: string;
      };
      if (axiosErr?.response?.status === 409) {
        setConflictDetailMsg(axiosErr.response.data?.detail || null);
        setIsConflictModalOpen(true);
        return;
      }
      showToast(
        axiosErr?.localizedMessage ||
          'Gagal menjalankan pembersihan otomatis.',
        'error'
      );
    },
  });

  // Mutasi 2: PATCH /anomalies/{anomaly_id} (Terima / Tolak / Kembalikan ke Pending)
  const singleReviewMutation = useMutation({
    mutationFn: (params: {
      anomalyId: number;
      status: AnomalyReviewActionStatus;
    }) => patchAnomalyStatus(params.anomalyId, params.status),
    onSuccess: async (res) => {
      setSelectedAnomalyIds((prev) => prev.filter((id) => id !== res.id));
      await invalidateAllRelatedQueries();
      const statusLabel =
        res.status === 'diterima'
          ? 'Diterima'
          : res.status === 'ditolak'
          ? 'Ditolak'
          : 'Dikembalikan ke Pending';
      showToast(`Status anomali berhasil diubah menjadi ${statusLabel}.`, 'success');
    },
  });

  // Mutasi 3: POST /datasets/{id}/anomalies/review (Bulk Review via Checkbox atau Filter)
  const bulkReviewMutation = useMutation({
    mutationFn: (payload: {
      status: AnomalyReviewActionStatus;
      jenis?: string | null;
      kolom?: string | null;
      ids?: number[] | null;
      semua?: boolean;
      dari_status?: AnomalyStatus | 'semua';
    }) => postBulkAnomalyReview(datasetId, payload),
    onSuccess: async (res) => {
      setSelectedAnomalyIds([]);
      setBulkFilterConfirm(null);
      await invalidateAllRelatedQueries();
      const label =
        res.status_baru === 'diterima'
          ? 'Diterima'
          : res.status_baru === 'ditolak'
          ? 'Ditolak'
          : 'Pending';
      showToast(
        `Verifikasi massal berhasil: ${formatNumberId(
          res.jumlah_diubah,
          0
        )} anomali diubah menjadi ${label}.`,
        'success'
      );
    },
  });

  // Mutasi 4: PATCH /datasets/{id}/data (Popover Inline Cell Editor)
  const editCellMutation = useMutation({
    mutationFn: (params: {
      rowIndex: number;
      kolom: string;
      nilai: string | number | null;
      alasan: string;
    }) =>
      patchDatasetCells(datasetId, {
        perubahan: [
          {
            row_index: params.rowIndex,
            kolom: params.kolom,
            nilai: params.nilai,
          },
        ],
        alasan: params.alasan,
      }),
    onSuccess: async (res) => {
      setActiveEditAnomalyId(null);
      setLastEditVerification({
        versiBaru: res.versi_baru,
        changes: res.perubahan,
      });
      if (res.peringatan && res.peringatan.length > 0) {
        setStaleForecastWarnings(res.peringatan);
      }
      await invalidateAllRelatedQueries();
      showToast(
        `Sel berhasil diperbaiki (Versi Bersih v${res.versi_baru}). Status anomali otomatis menjadi Diperbaiki.`,
        'success'
      );
    },
  });

  // Handler Tombol "Jalankan Pembersihan Otomatis"
  const handleRunCleaningClick = () => {
    if (dataset?.cleaning_ulang_butuh_konfirmasi) {
      setConflictDetailMsg(null);
      setIsConflictModalOpen(true);
      return;
    }
    cleanMutation.mutate(false);
  };

  // Hitung rincian jumlah anomali per jenis, kolom, dan status untuk pill filter
  const allLoadedAnomalies = useMemo(
    () => boundedAnomaliesData?.items || [],
    [boundedAnomaliesData]
  );

  const countsByJenis = useMemo(() => {
    const map: Record<string, number> = {
      outlier: 0,
      kosong: 0,
      format: 0,
      duplikat: 0,
    };
    if (cleanReport?.anomali_per_jenis) {
      for (const [k, v] of Object.entries(cleanReport.anomali_per_jenis)) {
        map[k] = v;
      }
      return map;
    }
    for (const a of allLoadedAnomalies) {
      map[a.jenis] = (map[a.jenis] || 0) + 1;
    }
    return map;
  }, [cleanReport, allLoadedAnomalies]);

  const countsByStatus = useMemo(() => {
    return {
      pending: dataset?.anomali?.pending ?? anomalySummary?.per_status?.pending ?? 0,
      diterima: dataset?.anomali?.diterima ?? anomalySummary?.per_status?.diterima ?? 0,
      ditolak: dataset?.anomali?.ditolak ?? anomalySummary?.per_status?.ditolak ?? 0,
      diperbaiki:
        dataset?.anomali?.diperbaiki ?? anomalySummary?.per_status?.diperbaiki ?? 0,
    };
  }, [dataset, anomalySummary]);

  const totalAnomaliesCount = useMemo(() => {
    return (
      countsByStatus.pending +
      countsByStatus.diterima +
      countsByStatus.ditolak +
      countsByStatus.diperbaiki
    );
  }, [countsByStatus]);

  // Daftar kolom yang memiliki anomali untuk pill filter kolom
  const anomalyColumnsList = useMemo(() => {
    const set = new Set<string>();
    for (const a of allLoadedAnomalies) {
      if (a.kolom && a.kolom !== '*') set.add(a.kolom);
    }
    return Array.from(set);
  }, [allLoadedAnomalies]);

  // Filter daftar anomali (untuk Mode Daftar Anomali & perhitungan Bulk Filter)
  const filteredAnomaliesList = useMemo(() => {
    if (isOver2000Anomalies) {
      return serverPagedAnomalies?.data || [];
    }
    const q = searchQuery.trim().toLowerCase();
    return allLoadedAnomalies.filter((a) => {
      if (filterJenis && a.jenis !== filterJenis) return false;
      if (filterKolom && a.kolom !== filterKolom) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (q) {
        const matchRow = String(a.baris_di_file_asli).includes(q);
        const matchCol = a.kolom.toLowerCase().includes(q);
        const matchReason = a.alasan.toLowerCase().includes(q);
        const rowData = rowMapping?.rowByRowIndex[a.row_index]?.data;
        const matchCellData = rowData
          ? Object.values(rowData).some((v) =>
              String(v ?? '')
                .toLowerCase()
                .includes(q)
            )
          : false;
        if (!matchRow && !matchCol && !matchReason && !matchCellData) {
          return false;
        }
      }
      return true;
    });
  }, [
    isOver2000Anomalies,
    serverPagedAnomalies,
    allLoadedAnomalies,
    filterJenis,
    filterKolom,
    filterStatus,
    searchQuery,
    rowMapping,
  ]);

  // Filter baris grid terverifikasi (untuk Mode Grid Data Terpadu)
  const filteredGridRows: VerifiedCleanRow[] = useMemo(() => {
    if (!rowMapping || !rowMapping.isValid) return [];
    const q = searchQuery.trim().toLowerCase();

    return rowMapping.verifiedRows.filter((row) => {
      const rowAnomalies = Object.values(row.anomaliesByCol);

      // Jika ada filter jenis, kolom, atau status anomali aktif: tampilkan baris yang memiliki anomali sesuai filter
      if (filterJenis || filterKolom || filterStatus) {
        const hasMatchingAnomaly = rowAnomalies.some((a) => {
          if (filterJenis && a.jenis !== filterJenis) return false;
          if (filterKolom && a.kolom !== filterKolom) return false;
          if (filterStatus && a.status !== filterStatus) return false;
          return true;
        });
        if (!hasMatchingAnomaly) return false;
      }

      if (q) {
        const matchBarisFile = String(row.barisDiFileAsli).includes(q);
        const matchValues = Object.values(row.data).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(q)
        );
        const matchReasons = rowAnomalies.some((a) =>
          a.alasan.toLowerCase().includes(q)
        );
        if (!matchBarisFile && !matchValues && !matchReasons) return false;
      }

      return true;
    });
  }, [rowMapping, filterJenis, filterKolom, filterStatus, searchQuery]);

  // Baris Grid pada halaman aktif
  const totalGridPages = Math.max(
    1,
    Math.ceil(filteredGridRows.length / pageSize)
  );
  const pagedGridRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGridRows.slice(start, start + pageSize);
  }, [filteredGridRows, currentPage, pageSize]);

  // Item Anomali pada halaman aktif (saat berada di Mode Daftar Anomali lokal <= 2.000)
  const totalListPages = isOver2000Anomalies
    ? Math.max(
        1,
        Math.ceil((serverPagedAnomalies?.total || 0) / serverAnomalyPageSize)
      )
    : Math.max(1, Math.ceil(filteredAnomaliesList.length / pageSize));

  const pagedAnomaliesList = useMemo(() => {
    if (isOver2000Anomalies) {
      return serverPagedAnomalies?.data || [];
    }
    const start = (currentPage - 1) * pageSize;
    return filteredAnomaliesList.slice(start, start + pageSize);
  }, [
    isOver2000Anomalies,
    serverPagedAnomalies,
    filteredAnomaliesList,
    currentPage,
    pageSize,
  ]);

  // Daftar ID anomali yang dapat dicentang (status !== 'diperbaiki') pada halaman yang sedang tampil
  const selectableAnomalyIdsOnPage = useMemo(() => {
    if (rowMapping?.isValid) {
      const ids: number[] = [];
      for (const row of pagedGridRows) {
        for (const a of Object.values(row.anomaliesByCol)) {
          if (a.status !== 'diperbaiki') {
            ids.push(a.id);
          }
        }
      }
      return ids;
    }
    return pagedAnomaliesList
      .filter((a) => a.status !== 'diperbaiki')
      .map((a) => a.id);
  }, [rowMapping, pagedGridRows, pagedAnomaliesList]);

  const isAllPageSelected =
    selectableAnomalyIdsOnPage.length > 0 &&
    selectableAnomalyIdsOnPage.every((id) => selectedAnomalyIds.includes(id));

  const handleToggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedAnomalyIds((prev) =>
        prev.filter((id) => !selectableAnomalyIdsOnPage.includes(id))
      );
    } else {
      setSelectedAnomalyIds((prev) => {
        const next = new Set(prev);
        for (const id of selectableAnomalyIdsOnPage) next.add(id);
        return Array.from(next);
      });
    }
  };

  const handleToggleRowAnomaliesSelection = (anomalyIds: number[]) => {
    if (anomalyIds.length === 0) return;
    const allIn = anomalyIds.every((id) => selectedAnomalyIds.includes(id));
    if (allIn) {
      setSelectedAnomalyIds((prev) =>
        prev.filter((id) => !anomalyIds.includes(id))
      );
    } else {
      setSelectedAnomalyIds((prev) => {
        const next = new Set(prev);
        for (const id of anomalyIds) next.add(id);
        return Array.from(next);
      });
    }
  };

  // Siapkan konfirmasi Aksi Massal Berdasarkan Filter (Butir f)
  const handlePrepareBulkByFilter = (targetStatus: 'diterima' | 'ditolak') => {
    const matchingPending = allLoadedAnomalies.filter((a) => {
      if (a.status !== 'pending') return false;
      if (filterJenis && a.jenis !== filterJenis) return false;
      if (filterKolom && a.kolom !== filterKolom) return false;
      return true;
    });

    const parts: string[] = ['Status saat ini: Pending'];
    if (filterJenis) parts.push(`Jenis: ${filterJenis}`);
    if (filterKolom) parts.push(`Kolom: ${filterKolom}`);
    if (!filterJenis && !filterKolom) parts.push('Cakupan: Seluruh anomali pending pada dataset ini');

    setBulkFilterConfirm({
      status: targetStatus,
      jenis: filterJenis,
      kolom: filterKolom,
      semua: !filterJenis && !filterKolom,
      dariStatus: 'pending',
      affectedCount: isOver2000Anomalies
        ? countsByStatus.pending
        : matchingPending.length,
      criteriaDescription: parts.join(' • '),
    });
  };

  const isInitialDataLoading =
    isDatasetLoading ||
    (hasCleanVersion &&
      (isCleanReportLoading ||
        isCleanPreviewLoading ||
        isRawPreviewLoading ||
        isAnomaliesLoading ||
        isEditsLoading));

  if (isDatasetLoading) {
    return (
      <div className="p-12 text-center text-sm text-text-muted-light dark:text-text-muted-dark">
        Memuat ruang kerja review anomali dan editor data...
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1840px] mx-auto">
      {/* Banner Peringatan Stale Forecast jika ada dari respons backend */}
      {(staleForecastWarnings.length > 0 ||
        (dataset?.ada_forecast && (dataset?.jumlah_edit_manual || 0) > 0)) && (
        <div
          role="status"
          className="p-4 rounded-card bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block">
                Peringatan Hasil Peramalan Usang (Stale Forecast)
              </strong>
              <span>
                {staleForecastWarnings.length > 0
                  ? staleForecastWarnings.join(' ')
                  : 'Data telah dimodifikasi setelah peramalan dibuat. Silakan jalankan ulang peramalan pada Tab 4.'}
              </span>
            </div>
          </div>
          {staleForecastWarnings.length > 0 && (
            <button
              type="button"
              onClick={() => setStaleForecastWarnings([])}
              aria-label="Tutup banner peringatan peramalan"
              className="p-1 rounded-button hover:bg-surface-light/40 dark:hover:bg-surface-dark/40"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Banner Verifikasi Perubahan Sel Terakhir (nilai_lama -> nilai_baru dari respons PATCH) */}
      {lastEditVerification && lastEditVerification.changes.length > 0 && (
        <div
          role="status"
          className="p-4 rounded-card bg-modified-bg-light/50 dark:bg-modified-bg-dark/60 border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark border-t border-r border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-text-primary-light dark:text-text-primary-dark">
            <CheckCircle2 className="w-4 h-4 text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex-shrink-0" />
            <span className="font-semibold">
              Tersimpan ke Versi Bersih v{lastEditVerification.versiBaru}:
            </span>
            {lastEditVerification.changes.map((chg) => (
              <span
                key={`${chg.row_index}-${chg.kolom}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark tabular-numbers"
              >
                <strong>Baris File #{chg.baris_di_file_asli}</strong>
                <span>({chg.kolom}):</span>
                <span className="line-through text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                  {formatCellValueId(chg.nilai_lama)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-text-muted-light dark:text-text-muted-dark" />
                <strong className="text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                  {formatCellValueId(chg.nilai_baru)}
                </strong>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLastEditVerification(null)}
            aria-label="Tutup ringkasan edit terakhir"
            className="p-1 rounded-button text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOOLBAR ATAS TAB 2: Aksi Tunggal Pembersihan, Ringkasan Anomali, Aksi Massal, Audit Log, & Apply Review (Nonaktif Fase 4) */}
      <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Kelompok Kiri: Satu-satunya tombol pembersihan + Lencana Total Anomali */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={handleRunCleaningClick}
              disabled={cleanMutation.isPending}
              icon={
                <Sparkles
                  className={`w-4 h-4 ${
                    cleanMutation.isPending ? 'animate-spin' : ''
                  }`}
                />
              }
            >
              {cleanMutation.isPending
                ? 'Menjalankan Pembersihan...'
                : 'Jalankan Pembersihan Otomatis'}
            </Button>

            {hasCleanVersion && (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-button bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light/25 dark:border-anomaly-warning-text-dark/30 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark text-xs font-semibold min-h-control">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="tabular-numbers">
                  <strong>{formatNumberId(totalAnomaliesCount, 0)}</strong>{' '}
                  anomali terdeteksi ({formatNumberId(countsByStatus.pending, 0)}{' '}
                  pending)
                </span>
              </div>
            )}
          </div>

          {/* Kelompok Kanan: Aksi Massal Checkbox, Tombol Drawer Audit Log (F-20), & Tombol Apply Review Nonaktif (Fase 4) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {hasCleanVersion && (
              <>
                {/* Terima Terpilih (Checkbox) */}
                <button
                  type="button"
                  disabled={
                    selectedAnomalyIds.length === 0 ||
                    bulkReviewMutation.isPending
                  }
                  onClick={() =>
                    bulkReviewMutation.mutate({
                      status: 'diterima',
                      ids: selectedAnomalyIds,
                      dari_status: 'semua',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-button bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark border border-anomaly-success-text-light/30 dark:border-anomaly-success-text-dark/40 hover:opacity-90 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed min-h-control tabular-numbers whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Terima Terpilih ({formatNumberId(selectedAnomalyIds.length, 0)})
                  </span>
                </button>

                {/* Tolak Terpilih (Checkbox) */}
                <button
                  type="button"
                  disabled={
                    selectedAnomalyIds.length === 0 ||
                    bulkReviewMutation.isPending
                  }
                  onClick={() =>
                    bulkReviewMutation.mutate({
                      status: 'ditolak',
                      ids: selectedAnomalyIds,
                      dari_status: 'semua',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 hover:opacity-90 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed min-h-control tabular-numbers whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  <span>
                    Tolak Terpilih ({formatNumberId(selectedAnomalyIds.length, 0)})
                  </span>
                </button>

                {/* Tombol Pembuka Slide-over Drawer Audit Log (F-20) */}
                <button
                  type="button"
                  onClick={() => setIsAuditDrawerOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-control whitespace-nowrap"
                >
                  <History className="w-4 h-4 text-modified-border-light dark:text-modified-border-dark" />
                  <span>Riwayat Edit (Audit Log)</span>
                  <span className="px-2 py-0.5 rounded-full font-mono font-bold tabular-numbers bg-modified-bg-light dark:bg-modified-bg-dark text-text-primary-light dark:text-text-primary-dark border border-modified-border-light/40 dark:border-modified-border-dark/40">
                    {formatNumberId(dataset?.jumlah_edit_manual || 0, 0)}
                  </span>
                </button>
              </>
            )}

            {/* Tombol Terapkan Hasil Review (Apply Review) - Ditampilkan Nonaktif karena Cakupan Fase 4 */}
            <div className="relative group inline-block">
              <button
                type="button"
                aria-disabled="true"
                aria-describedby="tooltip-apply-review-fase4"
                onClick={(e) => e.preventDefault()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark opacity-75 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Terapkan Hasil Review
                  {dataset?.versi_bersih
                    ? ` (v${dataset.versi_bersih} → v${dataset.versi_bersih + 1})`
                    : ''}
                </span>
              </button>
              <div
                id="tooltip-apply-review-fase4"
                role="tooltip"
                className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-popover bg-surface-dark text-text-primary-dark border border-border-dark text-xs font-medium whitespace-nowrap z-30 shadow-lg pointer-events-none"
              >
                Tersedia pada Fase 4 (Modal Konfirmasi Dua Langkah & Tabel Diff Apply Review)
              </div>
            </div>
          </div>
        </div>

        {/* Baris Filter Cepat: TIPE, KOLOM, STATUS, Aksi Massal Filter, dan Kotak Pencarian (Hanya tampil jika sudah di-cleaning) */}
        {hasCleanVersion && (
          <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-3">
            {/* Baris 1 Filter: TIPE & Pencarian */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mr-1">
                  Tipe:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterJenis(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] ${
                    filterJenis === null
                      ? 'bg-text-primary-light text-surface-light dark:bg-text-primary-dark dark:text-canvas-dark'
                      : 'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                  }`}
                >
                  Semua Jenis
                </button>
                {(
                  [
                    { id: 'outlier', label: 'Outlier' },
                    { id: 'kosong', label: 'Kosong' },
                    { id: 'format', label: 'Format' },
                    { id: 'duplikat', label: 'Duplikat' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setFilterJenis((prev) =>
                        prev === item.id ? null : item.id
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] tabular-numbers ${
                      filterJenis === item.id
                        ? 'bg-text-primary-light text-surface-light dark:bg-text-primary-dark dark:text-canvas-dark'
                        : 'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                    }`}
                  >
                    {item.label} ({formatNumberId(countsByJenis[item.id] || 0, 0)})
                  </button>
                ))}
              </div>

              {/* Kotak Pencarian Baris / Nilai / Alasan */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari baris file, wilayah, nilai..."
                  aria-label="Cari baris, wilayah, atau nilai"
                  className="w-full pl-9 pr-8 py-1.5 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-muted-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Baris 2 Filter: KOLOM */}
            {anomalyColumnsList.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mr-1">
                  Kolom:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterKolom(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] ${
                    filterKolom === null
                      ? 'bg-text-primary-light text-surface-light dark:bg-text-primary-dark dark:text-canvas-dark'
                      : 'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                  }`}
                >
                  Semua Kolom
                </button>
                {anomalyColumnsList.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() =>
                      setFilterKolom((prev) => (prev === col ? null : col))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-colors min-h-[34px] ${
                      filterKolom === col
                        ? 'bg-text-primary-light text-surface-light dark:bg-text-primary-dark dark:text-canvas-dark'
                        : 'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            )}

            {/* Baris 3 Filter: STATUS + Aksi Massal Berdasarkan Kriteria Filter (Butir f) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mr-1">
                  Status:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterStatus(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] ${
                    filterStatus === null
                      ? 'bg-text-primary-light text-surface-light dark:bg-text-primary-dark dark:text-canvas-dark'
                      : 'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                  }`}
                >
                  Semua Status
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus((prev) =>
                      prev === 'pending' ? null : 'pending'
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] tabular-numbers ${
                    filterStatus === 'pending'
                      ? 'bg-anomaly-warning-text-light text-white dark:bg-anomaly-warning-text-dark dark:text-canvas-dark'
                      : 'bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark'
                  }`}
                >
                  Pending ({formatNumberId(countsByStatus.pending, 0)})
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus((prev) =>
                      prev === 'diterima' ? null : 'diterima'
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] tabular-numbers ${
                    filterStatus === 'diterima'
                      ? 'bg-anomaly-success-text-light text-white dark:bg-anomaly-success-text-dark dark:text-canvas-dark'
                      : 'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark'
                  }`}
                >
                  Diterima ({formatNumberId(countsByStatus.diterima, 0)})
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus((prev) =>
                      prev === 'ditolak' ? null : 'ditolak'
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] tabular-numbers ${
                    filterStatus === 'ditolak'
                      ? 'bg-anomaly-danger-text-light text-white dark:bg-anomaly-danger-text-dark dark:text-canvas-dark'
                      : 'bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark'
                  }`}
                >
                  Ditolak ({formatNumberId(countsByStatus.ditolak, 0)})
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus((prev) =>
                      prev === 'diperbaiki' ? null : 'diperbaiki'
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] tabular-numbers ${
                    filterStatus === 'diperbaiki'
                      ? 'bg-modified-border-light text-white dark:bg-modified-border-dark dark:text-canvas-dark'
                      : 'bg-modified-bg-light dark:bg-modified-bg-dark text-text-primary-light dark:text-text-primary-dark border border-modified-border-light/40 dark:border-modified-border-dark/40'
                  }`}
                >
                  Diperbaiki ({formatNumberId(countsByStatus.diperbaiki, 0)})
                </button>
              </div>

              {/* Tombol Aksi Massal Berdasarkan Kriteria Filter (Bukan Checkbox) */}
              {countsByStatus.pending > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1">
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Aksi Massal Filter:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePrepareBulkByFilter('diterima')}
                    disabled={bulkReviewMutation.isPending}
                    className="px-3 py-1.5 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-anomaly-success-text-light/40 dark:border-anomaly-success-text-dark/40 text-anomaly-success-text-light dark:text-anomaly-success-text-dark hover:bg-anomaly-success-bg-light dark:hover:bg-anomaly-success-bg-dark transition-colors min-h-[34px]"
                  >
                    Terima Semua Pending Sesuai Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrepareBulkByFilter('ditolak')}
                    disabled={bulkReviewMutation.isPending}
                    className="px-3 py-1.5 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-anomaly-danger-text-light/40 dark:border-anomaly-danger-text-dark/40 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark hover:bg-anomaly-danger-bg-light dark:hover:bg-anomaly-danger-bg-dark transition-colors min-h-[34px]"
                  >
                    Tolak Semua Pending Sesuai Filter
                  </button>
                </div>
              )}
            </div>

            {/* Banner Konfirmasi Singkat untuk Aksi Massal Berdasarkan Filter (Butir f) */}
            {bulkFilterConfirm && (
              <div
                role="region"
                aria-label="Konfirmasi aksi massal berdasarkan filter"
                className="p-3.5 rounded-card bg-header-light dark:bg-header-dark border-2 border-brand-primary-light dark:border-brand-primary-dark flex flex-wrap items-center justify-between gap-3"
              >
                <div className="text-xs sm:text-sm text-text-primary-light dark:text-text-primary-dark space-y-0.5">
                  <div className="font-bold">
                    Konfirmasi Aksi Massal Berdasarkan Filter: Ubah ke{' '}
                    <span className="uppercase">
                      {bulkFilterConfirm.status}
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Kriteria: <strong>{bulkFilterConfirm.criteriaDescription}</strong> •
                    Jumlah anomali yang akan terpengaruh:{' '}
                    <strong className="font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                      {formatNumberId(bulkFilterConfirm.affectedCount, 0)} anomali
                    </strong>{' '}
                    (anomali berstatus Diperbaiki tidak akan diubah).
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setBulkFilterConfirm(null)}
                    disabled={bulkReviewMutation.isPending}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant={
                      bulkFilterConfirm.status === 'ditolak'
                        ? 'danger'
                        : 'primary'
                    }
                    disabled={
                      bulkFilterConfirm.affectedCount === 0 ||
                      bulkReviewMutation.isPending
                    }
                    onClick={() =>
                      bulkReviewMutation.mutate({
                        status: bulkFilterConfirm.status,
                        jenis: bulkFilterConfirm.jenis,
                        kolom: bulkFilterConfirm.kolom,
                        semua: bulkFilterConfirm.semua,
                        dari_status: bulkFilterConfirm.dariStatus,
                      })
                    }
                  >
                    {bulkReviewMutation.isPending
                      ? 'Memproses...'
                      : `Ya, ${
                          bulkFilterConfirm.status === 'diterima'
                            ? 'Terima'
                            : 'Tolak'
                        } ${formatNumberId(
                          bulkFilterConfirm.affectedCount,
                          0
                        )} Anomali`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KONDISI BELUM DI-CLEANING (Status Uploaded / Versi Bersih Null) */}
      {!hasCleanVersion ? (
        <div className="p-12 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-button bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">
              Dataset Belum Melalui Pembersihan Otomatis
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Klik tombol <strong>&ldquo;Jalankan Pembersihan Otomatis&rdquo;</strong> untuk
              menormalisasi format kolom, menghapus baris duplikat, mendeteksi outlier,
              serta menandai sel kosong sebelum meninjau anomali pada tabel data.
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="primary"
              onClick={handleRunCleaningClick}
              disabled={cleanMutation.isPending}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {cleanMutation.isPending
                ? 'Menjalankan Pembersihan...'
                : 'Jalankan Pembersihan Otomatis Sekarang'}
            </Button>
          </div>
        </div>
      ) : isInitialDataLoading ? (
        <div className="p-12 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center text-sm text-text-muted-light dark:text-text-muted-dark">
          Memuat data bersih, laporan pembersihan, dan pemetaan anomali...
        </div>
      ) : (
        <>
          {/* PANEL LAPORAN PEMBERSIHAN (F-12) & RINGKASAN ANOMALI (F-13) */}
          <CleanReportPanel
            cleanReport={cleanReport}
            anomalySummary={anomalySummary}
            isSummaryLoading={isSummaryLoading}
            groupBy={summaryGroupBy}
            dataKolom={summaryDataKolom}
            availableColumns={availableColumns}
            onGroupByChange={(g) => setSummaryGroupBy(g)}
            onDataKolomChange={(k) => setSummaryDataKolom(k)}
            onQuickFilterFromGroup={(g, val) => {
              if (g === 'jenis') {
                setFilterJenis((prev) => (prev === val ? null : val));
              } else if (g === 'kolom' && val !== '(seluruh baris)') {
                setFilterKolom((prev) => (prev === val ? null : val));
              } else if (
                g === 'status' &&
                (val === 'pending' ||
                  val === 'diterima' ||
                  val === 'ditolak' ||
                  val === 'diperbaiki')
              ) {
                setFilterStatus((prev) => (prev === val ? null : val));
              }
            }}
          />

          {/* Banner Informasi Batas 200 Baris Pratinjau atau Batas 2.000 Anomali */}
          {isOver2000Anomalies && (
            <div
              role="status"
              className="p-3.5 rounded-card bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex items-center gap-2.5 text-xs text-text-secondary-light dark:text-text-secondary-dark"
            >
              <Info className="w-4 h-4 text-brand-cyan flex-shrink-0" />
              <span>
                Menampilkan{' '}
                <strong className="font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(pagedAnomaliesList.length, 0)}
                </strong>{' '}
                dari{' '}
                <strong className="font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                  {formatNumberId(
                    serverPagedAnomalies?.total ?? totalAnomaliesCount,
                    0
                  )}
                </strong>{' '}
                anomali menggunakan paginasi server; gunakan filter di atas untuk mempersempit daftar.
              </span>
            </div>
          )}

          {!isOver2000Anomalies &&
            rowMapping?.isValid &&
            (dataset?.baris_bersih || 0) > 200 && (
              <div
                role="status"
                className="p-3.5 rounded-card bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex items-center gap-2.5 text-xs text-text-secondary-light dark:text-text-secondary-dark"
              >
                <Info className="w-4 h-4 text-brand-cyan flex-shrink-0" />
                <span>
                  Grid pratinjau menampilkan <strong>200 baris pertama</strong>{' '}
                  dari{' '}
                  <strong className="font-mono tabular-numbers">
                    {formatNumberId(dataset?.baris_bersih, 0)}
                  </strong>{' '}
                  baris data bersih (batas endpoint <code>clean-preview</code> saat ini sampai B-05 aktif).
                </span>
              </div>
            )}

          {/* CABANG TAMPILAN UTAMA: MODE GRID DATA TERVERIFIKASI vs MODE DAFTAR ANOMALI (FALLBACK AMAN) */}
          {rowMapping && rowMapping.isValid ? (
            /* ============================================================================
             * MODE 1: GRID DATA BERSIH TERPADU DENGAN PENANDA WARNA ANOMALI (F-14, F-15)
             * ============================================================================ */
            <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
              {/* Pembungkus Scroll Horizontal & Vertikal dengan Sticky Header & Sticky Kolom Pertama */}
              <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0 z-20">
                      {/* Kolom Sticky 1: Checkbox + Nomor Baris di File Asli ("Baris File") */}
                      <th
                        className="py-3.5 px-4 sticky left-0 z-30 bg-header-light dark:bg-header-dark border-r border-border-light dark:border-border-dark whitespace-nowrap"
                        title="Nomor baris di file CSV/Excel asli (row_index + 2; baris 1 adalah header)"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isAllPageSelected}
                            disabled={selectableAnomalyIdsOnPage.length === 0}
                            onChange={handleToggleSelectAllPage}
                            aria-label="Pilih semua anomali di halaman ini"
                            className="w-4 h-4 rounded-cell-input border-border-light dark:border-border-dark text-brand-primary-light focus:ring-brand-primary-light cursor-pointer disabled:opacity-40"
                          />
                          <span>Baris File</span>
                        </div>
                      </th>

                      {/* Kolom Data Dataset */}
                      {availableColumns.map((col) => (
                        <th
                          key={col}
                          className="py-3.5 px-4 whitespace-nowrap font-bold"
                        >
                          {col}
                        </th>
                      ))}

                      {/* Kolom Aksi Kurasi */}
                      <th className="py-3.5 px-4 whitespace-nowrap text-right">
                        Aksi Kurasi
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
                    {pagedGridRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={availableColumns.length + 2}
                          className="py-12 text-center font-sans text-sm text-text-muted-light dark:text-text-muted-dark"
                        >
                          Tidak ada baris data yang cocok dengan filter saat ini.
                        </td>
                      </tr>
                    ) : (
                      pagedGridRows.map((row) => {
                        const rowAnomalies = Object.values(row.anomaliesByCol);
                        const selectableRowAnomalyIds = rowAnomalies
                          .filter((a) => a.status !== 'diperbaiki')
                          .map((a) => a.id);
                        const isRowChecked =
                          selectableRowAnomalyIds.length > 0 &&
                          selectableRowAnomalyIds.every((id) =>
                            selectedAnomalyIds.includes(id)
                          );

                        const allRowRejected =
                          rowAnomalies.length > 0 &&
                          rowAnomalies.every((a) => a.status === 'ditolak');

                        return (
                          <tr
                            key={row.rowIndex}
                            className={`transition-colors ${
                              allRowRejected
                                ? 'bg-anomaly-danger-bg-light/30 dark:bg-anomaly-danger-bg-dark/30'
                                : 'hover:bg-canvas-light dark:hover:bg-canvas-dark/50'
                            }`}
                          >
                            {/* Kolom Sticky 1: Checkbox + Baris File (#barisDiFileAsli) */}
                            <td
                              className="py-3 px-4 sticky left-0 z-10 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark whitespace-nowrap align-top"
                              title={`Baris ke-${row.barisDiFileAsli} pada file CSV/Excel asli (row_index database: ${row.rowIndex})`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isRowChecked}
                                  disabled={
                                    selectableRowAnomalyIds.length === 0
                                  }
                                  onChange={() =>
                                    handleToggleRowAnomaliesSelection(
                                      selectableRowAnomalyIds
                                    )
                                  }
                                  aria-label={`Pilih anomali pada baris file ${row.barisDiFileAsli}`}
                                  className="w-4 h-4 rounded-cell-input border-border-light dark:border-border-dark text-brand-primary-light focus:ring-brand-primary-light cursor-pointer disabled:opacity-30"
                                />
                                <span
                                  className={`text-xs font-bold ${
                                    allRowRejected
                                      ? 'line-through text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark'
                                      : 'text-text-secondary-light dark:text-text-secondary-dark'
                                  }`}
                                >
                                  #{row.barisDiFileAsli}
                                </span>
                              </div>
                            </td>

                            {/* Sel-sel Data per Kolom */}
                            {availableColumns.map((col) => {
                              const cellAnomaly =
                                row.anomaliesByCol[col] ||
                                row.anomaliesByCol['*'];
                              const cellVal = row.data[col];
                              const isNumericCol = numericColumnsSet.has(col);
                              const isEditingThisCell =
                                cellAnomaly !== undefined &&
                                activeEditAnomalyId === cellAnomaly.id;

                              // Kelas visual status anomali sesuai token design-system.md + penanda non-warna
                              let cellStateClasses =
                                'text-text-primary-light dark:text-text-primary-dark';
                              let statusIcon: React.ReactNode = null;
                              let statusLabelText: string | null = null;

                              if (cellAnomaly) {
                                if (cellAnomaly.status === 'pending') {
                                  cellStateClasses =
                                    'bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark font-semibold';
                                  statusIcon = (
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                  );
                                  statusLabelText = 'Pending';
                                } else if (cellAnomaly.status === 'diterima') {
                                  cellStateClasses =
                                    'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark font-semibold';
                                  statusIcon = (
                                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                                  );
                                  statusLabelText = 'Diterima';
                                } else if (cellAnomaly.status === 'ditolak') {
                                  cellStateClasses =
                                    'bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark line-through font-semibold';
                                  statusIcon = (
                                    <X className="w-3.5 h-3.5 flex-shrink-0" />
                                  );
                                  statusLabelText = 'Ditolak';
                                } else if (
                                  cellAnomaly.status === 'diperbaiki'
                                ) {
                                  cellStateClasses =
                                    'bg-modified-bg-light dark:bg-modified-bg-dark text-text-primary-light dark:text-text-primary-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark font-semibold';
                                  statusIcon = (
                                    <Edit3 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark flex-shrink-0" />
                                  );
                                  statusLabelText = 'Diperbaiki';
                                }
                              }

                              return (
                                <td
                                  key={col}
                                  className={`py-2.5 px-4 whitespace-nowrap rounded-cell align-top relative ${cellStateClasses} ${
                                    isNumericCol ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div
                                      className={`flex items-center gap-1.5 ${
                                        isNumericCol
                                          ? 'justify-end'
                                          : 'justify-start'
                                      }`}
                                    >
                                      {statusIcon}
                                      <span>{formatCellValueId(cellVal)}</span>
                                    </div>

                                    {/* Alasan anomali apa adanya dari backend + badge status non-warna */}
                                    {cellAnomaly && (
                                      <div
                                        className={`flex flex-col gap-0.5 text-[11px] font-sans leading-tight ${
                                          isNumericCol
                                            ? 'items-end'
                                            : 'items-start'
                                        }`}
                                      >
                                        <span className="font-mono opacity-90 whitespace-normal max-w-[240px]">
                                          {cellAnomaly.alasan}
                                        </span>
                                        <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-[10px]">
                                          [{statusLabelText}]
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Popover Inline Cell Editor (Hanya untuk sel beranomali) */}
                                  {isEditingThisCell && cellAnomaly && (
                                    <div className="mt-2 flex justify-start">
                                      <InlineCellEditorPopover
                                        anomaly={cellAnomaly}
                                        verifiedCurrentValue={cellVal}
                                        isValueVerified={true}
                                        isNumericColumn={isNumericCol}
                                        isSaving={editCellMutation.isPending}
                                        onCancel={() =>
                                          setActiveEditAnomalyId(null)
                                        }
                                        onSave={(payload) =>
                                          editCellMutation.mutate(payload)
                                        }
                                      />
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            {/* Kolom Aksi Kurasi Baris (Selalu memakai anomaly.id, anomaly.row_index, anomaly.kolom dari backend) */}
                            <td className="py-2.5 px-4 whitespace-nowrap align-top text-right font-sans">
                              {rowAnomalies.length === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-text-muted-light dark:text-text-muted-dark bg-header-light/60 dark:bg-header-dark/60">
                                  <Check className="w-3.5 h-3.5 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
                                  <span>Tervalidasi (Hanya-Baca)</span>
                                </span>
                              ) : (
                                <div className="flex flex-col items-end gap-2">
                                  {rowAnomalies.map((anom) => (
                                    <div
                                      key={anom.id}
                                      className="flex flex-wrap items-center justify-end gap-1.5"
                                    >
                                      {rowAnomalies.length > 1 && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark">
                                          {anom.kolom}:
                                        </span>
                                      )}

                                      {/* Tombol Edit Sel (Tersedia untuk semua sel beranomali) */}
                                      {anom.kolom !== '*' && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveEditAnomalyId((prev) =>
                                              prev === anom.id ? null : anom.id
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-brand-primary-light/40 dark:border-brand-primary-dark/40 text-brand-primary-light dark:text-brand-primary-dark hover:bg-brand-primary-light/10 dark:hover:bg-brand-primary-dark/15 transition-colors min-h-[34px]"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                          <span>
                                            {activeEditAnomalyId === anom.id
                                              ? 'Tutup Edit'
                                              : 'Edit'}
                                          </span>
                                        </button>
                                      )}

                                      {/* Status PENDING: tampilkan Terima & Tolak */}
                                      {anom.status === 'pending' && (
                                        <>
                                          <button
                                            type="button"
                                            disabled={
                                              singleReviewMutation.isPending
                                            }
                                            onClick={() =>
                                              singleReviewMutation.mutate({
                                                anomalyId: anom.id,
                                                status: 'diterima',
                                              })
                                            }
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark border border-anomaly-success-text-light/30 dark:border-anomaly-success-text-dark/40 hover:opacity-90 transition-opacity min-h-[34px]"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Terima</span>
                                          </button>

                                          <button
                                            type="button"
                                            disabled={
                                              singleReviewMutation.isPending
                                            }
                                            onClick={() =>
                                              singleReviewMutation.mutate({
                                                anomalyId: anom.id,
                                                status: 'ditolak',
                                              })
                                            }
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 hover:opacity-90 transition-opacity min-h-[34px]"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                            <span>Tolak</span>
                                          </button>
                                        </>
                                      )}

                                      {/* Status DITERIMA atau DITOLAK: tampilkan lencana status + tombol Batalkan ke Pending (Butir g) */}
                                      {(anom.status === 'diterima' ||
                                        anom.status === 'ditolak') && (
                                        <>
                                          <span
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-button text-xs font-semibold ${
                                              anom.status === 'diterima'
                                                ? 'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark'
                                                : 'bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark'
                                            }`}
                                          >
                                            {anom.status === 'diterima' ? (
                                              <>
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Diterima</span>
                                              </>
                                            ) : (
                                              <>
                                                <X className="w-3.5 h-3.5" />
                                                <span>Ditolak (Siap Hapus)</span>
                                              </>
                                            )}
                                          </span>

                                          <button
                                            type="button"
                                            disabled={
                                              singleReviewMutation.isPending
                                            }
                                            onClick={() =>
                                              singleReviewMutation.mutate({
                                                anomalyId: anom.id,
                                                status: 'pending',
                                              })
                                            }
                                            title="Batalkan dan kembalikan status ke Pending"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-[34px]"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>Batalkan</span>
                                          </button>
                                        </>
                                      )}

                                      {/* Status DIPERBAIKI: tidak punya tombol batalkan; beri keterangan tercatat di Audit Log (Butir g) */}
                                      {anom.status === 'diperbaiki' && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsAuditDrawerOpen(true)
                                          }
                                          title="Klik untuk membuka Riwayat Perubahan Data (Audit Log)"
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-xs font-semibold bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark hover:opacity-90 transition-opacity min-h-[34px]"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark" />
                                          <span>Tercatat di Audit Log</span>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Tabel: Panduan Indikator Tanpa Kode Hex & Kontrol Paginasi */}
              <div className="px-5 py-3.5 bg-header-light/50 dark:bg-header-dark/50 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
                {/* Panduan Indikator (Tanpa kode hex di teks) */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                    Panduan Indikator:
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark">
                    <span className="w-3.5 h-3.5 rounded-sm bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light dark:border-anomaly-warning-text-dark inline-block" />
                    <span>Amber: Pending (Perlu Verifikasi)</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark">
                    <span className="w-3.5 h-3.5 rounded-sm bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark inline-block" />
                    <span>Kuning (Garis Kiri Tebal): Diperbaiki Manual</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark">
                    <span className="w-3.5 h-3.5 rounded-sm bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark border border-anomaly-success-text-light dark:border-anomaly-success-text-dark inline-block" />
                    <span>Hijau: Diterima / Valid</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark">
                    <span className="w-3.5 h-3.5 rounded-sm bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border border-anomaly-danger-text-light dark:border-anomaly-danger-text-dark inline-block" />
                    <span>Merah Coret: Ditolak</span>
                  </span>
                </div>

                {/* Paginasi & Pemilih Jumlah Baris (50 / 100) */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark">
                    <span>Baris per halaman:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      aria-label="Pilih jumlah baris per halaman"
                      className="px-2 py-1 rounded-input border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark font-mono"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <span className="text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                    Menampilkan{' '}
                    <strong>
                      {filteredGridRows.length === 0
                        ? 0
                        : (currentPage - 1) * pageSize + 1}
                      –
                      {Math.min(
                        currentPage * pageSize,
                        filteredGridRows.length
                      )}
                    </strong>{' '}
                    dari{' '}
                    <strong>{formatNumberId(filteredGridRows.length, 0)}</strong>{' '}
                    baris
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      aria-label="Halaman sebelumnya"
                      className="p-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 py-1 rounded-button bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark font-mono font-bold tabular-numbers">
                      {currentPage} / {totalGridPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalGridPages}
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(totalGridPages, p + 1)
                        )
                      }
                      aria-label="Halaman berikutnya"
                      className="p-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================================
             * MODE 2: MODE DAFTAR ANOMALI (FALLBACK AMAN SAAT UJI SILANG GAGAL / > 2.000)
             * ============================================================================ */
            <div className="space-y-4">
              {/* Banner Penjelasan Mengapa Beralih ke Mode Daftar Anomali */}
              <div
                role="alert"
                className="p-4 rounded-card bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm space-y-1">
                  <div className="font-bold">
                    Mode Daftar Anomali Aktif (Perlindungan Keselamatan Pengenal Baris)
                  </div>
                  <p>
                    {rowMapping?.failureReason ||
                      'Pemetaan baris pratinjau tidak dapat diverifikasi secara 100% pasti. Untuk mencegah kesalahan penimpaan baris, pewarnaan grid dinonaktifkan dan seluruh anomali ditampilkan langsung menggunakan nomor baris asli dari backend.'}
                  </p>
                </div>
              </div>

              {/* Tabel Mode Daftar Anomali */}
              <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden">
                <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
                    <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                      Daftar Anomali Terdeteksi (Berdasarkan Nomor Baris File Asli)
                    </h3>
                  </div>
                  {isAnomaliesFetching && (
                    <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                      Menyegarkan daftar...
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                        <th
                          className="py-3.5 px-4 whitespace-nowrap"
                          title="Nomor baris di file CSV/Excel asli (row_index + 2; baris 1 adalah header)"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isAllPageSelected}
                              disabled={
                                selectableAnomalyIdsOnPage.length === 0
                              }
                              onChange={handleToggleSelectAllPage}
                              aria-label="Pilih semua anomali di halaman ini"
                              className="w-4 h-4 rounded-cell-input border-border-light dark:border-border-dark text-brand-primary-light focus:ring-brand-primary-light cursor-pointer"
                            />
                            <span>Baris File</span>
                          </div>
                        </th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Kolom</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Jenis</th>
                        <th className="py-3.5 px-4">
                          Alasan Anomali (Dari Backend)
                        </th>
                        <th className="py-3.5 px-4 whitespace-nowrap">
                          Status
                        </th>
                        <th className="py-3.5 px-4 whitespace-nowrap text-right">
                          Aksi Kurasi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                      {isServerPagedLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-sm text-text-muted-light dark:text-text-muted-dark"
                          >
                            Memuat halaman anomali dari server...
                          </td>
                        </tr>
                      ) : pagedAnomaliesList.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-sm text-text-muted-light dark:text-text-muted-dark"
                          >
                            Tidak ada anomali yang cocok dengan filter saat ini.
                          </td>
                        </tr>
                      ) : (
                        pagedAnomaliesList.map((anom) => {
                          const isChecked = selectedAnomalyIds.includes(
                            anom.id
                          );
                          const isEditingThis =
                            activeEditAnomalyId === anom.id;
                          const isNumericCol = numericColumnsSet.has(
                            anom.kolom
                          );

                          return (
                            <tr
                              key={anom.id}
                              className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                            >
                              <td className="py-3 px-4 font-mono text-xs font-bold tabular-numbers whitespace-nowrap align-top">
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={anom.status === 'diperbaiki'}
                                    onChange={() =>
                                      handleToggleRowAnomaliesSelection([
                                        anom.id,
                                      ])
                                    }
                                    aria-label={`Pilih anomali baris file ${anom.baris_di_file_asli}`}
                                    className="w-4 h-4 rounded-cell-input border-border-light dark:border-border-dark text-brand-primary-light focus:ring-brand-primary-light cursor-pointer disabled:opacity-30"
                                  />
                                  <span>#{anom.baris_di_file_asli}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs font-bold whitespace-nowrap align-top text-text-primary-light dark:text-text-primary-dark">
                                {anom.kolom}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs whitespace-nowrap align-top">
                                <span className="px-2.5 py-0.5 rounded-full bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark">
                                  {anom.jenis}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-xs align-top text-text-primary-light dark:text-text-primary-dark">
                                <div>{anom.alasan}</div>
                                {isEditingThis && (
                                  <div className="mt-3">
                                    <InlineCellEditorPopover
                                      anomaly={anom}
                                      verifiedCurrentValue={undefined}
                                      isValueVerified={false}
                                      isNumericColumn={isNumericCol}
                                      isSaving={editCellMutation.isPending}
                                      onCancel={() =>
                                        setActiveEditAnomalyId(null)
                                      }
                                      onSave={(payload) =>
                                        editCellMutation.mutate(payload)
                                      }
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap align-top">
                                {anom.status === 'pending' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Pending</span>
                                  </span>
                                )}
                                {anom.status === 'diterima' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Diterima</span>
                                  </span>
                                )}
                                {anom.status === 'ditolak' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark line-through">
                                    <X className="w-3.5 h-3.5" />
                                    <span>Ditolak</span>
                                  </span>
                                )}
                                {anom.status === 'diperbaiki' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-button text-xs font-semibold bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark">
                                    <Edit3 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark" />
                                    <span>Diperbaiki</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap align-top text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {anom.kolom !== '*' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveEditAnomalyId((prev) =>
                                          prev === anom.id ? null : anom.id
                                        )
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-brand-primary-light/40 dark:border-brand-primary-dark/40 text-brand-primary-light dark:text-brand-primary-dark hover:bg-brand-primary-light/10 min-h-[34px]"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>
                                        {isEditingThis ? 'Tutup Edit' : 'Edit'}
                                      </span>
                                    </button>
                                  )}

                                  {anom.status === 'pending' && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={
                                          singleReviewMutation.isPending
                                        }
                                        onClick={() =>
                                          singleReviewMutation.mutate({
                                            anomalyId: anom.id,
                                            status: 'diterima',
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark border border-anomaly-success-text-light/30 min-h-[34px]"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Terima</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          singleReviewMutation.isPending
                                        }
                                        onClick={() =>
                                          singleReviewMutation.mutate({
                                            anomalyId: anom.id,
                                            status: 'ditolak',
                                          })
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark border border-anomaly-danger-text-light/30 min-h-[34px]"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Tolak</span>
                                      </button>
                                    </>
                                  )}

                                  {(anom.status === 'diterima' ||
                                    anom.status === 'ditolak') && (
                                    <button
                                      type="button"
                                      disabled={singleReviewMutation.isPending}
                                      onClick={() =>
                                        singleReviewMutation.mutate({
                                          anomalyId: anom.id,
                                          status: 'pending',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light min-h-[34px]"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Batalkan</span>
                                    </button>
                                  )}

                                  {anom.status === 'diperbaiki' && (
                                    <button
                                      type="button"
                                      onClick={() => setIsAuditDrawerOpen(true)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-xs font-semibold bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark min-h-[34px]"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark" />
                                      <span>Tercatat di Audit Log</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Paginasi Mode Daftar Anomali */}
                <div className="px-5 py-3.5 bg-header-light/50 dark:bg-header-dark/50 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4 text-xs">
                  <span className="text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                    Menampilkan{' '}
                    <strong>{formatNumberId(pagedAnomaliesList.length, 0)}</strong>{' '}
                    anomali
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={
                        (isOver2000Anomalies
                          ? serverAnomalyPage
                          : currentPage) <= 1
                      }
                      onClick={() => {
                        if (isOver2000Anomalies) {
                          setServerAnomalyPage((p) => Math.max(1, p - 1));
                        } else {
                          setCurrentPage((p) => Math.max(1, p - 1));
                        }
                      }}
                      aria-label="Halaman daftar anomali sebelumnya"
                      className="p-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 py-1 rounded-button bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark font-mono font-bold tabular-numbers">
                      {isOver2000Anomalies ? serverAnomalyPage : currentPage} /{' '}
                      {totalListPages}
                    </span>
                    <button
                      type="button"
                      disabled={
                        (isOver2000Anomalies
                          ? serverAnomalyPage
                          : currentPage) >= totalListPages
                      }
                      onClick={() => {
                        if (isOver2000Anomalies) {
                          setServerAnomalyPage((p) =>
                            Math.min(totalListPages, p + 1)
                          );
                        } else {
                          setCurrentPage((p) =>
                            Math.min(totalListPages, p + 1)
                          );
                        }
                      }}
                      aria-label="Halaman daftar anomali berikutnya"
                      className="p-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Konfirmasi Konflik 409 (?timpa=true) */}
      <CleanConflictModal
        isOpen={isConflictModalOpen}
        isSubmitting={cleanMutation.isPending}
        versiBersihSaatIni={dataset?.versi_bersih ?? null}
        jumlahEditManual={dataset?.jumlah_edit_manual ?? 0}
        jumlahReviewDiterapkan={dataset?.jumlah_review_diterapkan ?? 0}
        serverConflictDetail={conflictDetailMsg}
        onCancel={() => {
          setIsConflictModalOpen(false);
          setConflictDetailMsg(null);
        }}
        onConfirmOverwrite={() => cleanMutation.mutate(true)}
      />

      {/* Slide-over Drawer Audit Log (F-20) */}
      <AuditLogDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        editsResponse={editsResponse}
        isLoading={isEditsLoading}
        isFetching={isEditsFetching}
        onRefresh={() => refetchEdits()}
      />
    </div>
  );
};
