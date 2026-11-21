import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit3,
  FileDiff,
  History,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AnomalyItem,
  ApplyReviewResponse,
  CleanReportResponse,
  DataEditsListResponse,
  DatasetDetail,
  RejectedAnomaliesClassification,
} from '@/types/dataset';
import {
  formatCellValueId,
  formatNumberId,
  formatPercentId,
} from '@/utils/formatters';
import { VerifiedCleanRow } from '@/utils/rowIndexMapper';

interface ReviewImpactComparisonPanelProps {
  dataset?: DatasetDetail;
  cleanReport?: CleanReportResponse;
  editsResponse?: DataEditsListResponse;
  applyPreviewData?: ApplyReviewResponse | null;
  rejectedClassification: RejectedAnomaliesClassification;
  allLoadedAnomalies: AnomalyItem[];
  isRowMappingValid: boolean;
  rowByRowIndex: Record<number, VerifiedCleanRow>;
  onOpenAuditDrawer: () => void;
}

type DiffFilterStatus =
  | 'semua'
  | 'diperbaiki'
  | 'ditolak_aktif'
  | 'ditolak_dibuang'
  | 'diterima';

interface DiffTableRowItem {
  key: string;
  rowIndex: number;
  barisDiFileAsli: number;
  kolom: string;
  nilaiSebelum: string;
  nilaiSesudah: string;
  statusType: 'diperbaiki' | 'ditolak_aktif' | 'ditolak_dibuang' | 'diterima';
  alasanText: string;
  versiInfo: string | null;
}

/**
 * Ekstrak "Nilai Sebelum" secara ketat HANYA jika teks alasan cocok persis dengan pola backend
 * (`backend/app/cleaning/engine.py`):
 * - `[outlier] nilai <angka> di luar rentang wajar ...` atau `[outlier] nilai <angka> z-score ...`
 * - `[format] nilai '<teks>' bukan angka`
 * - `[kosong] nilai tidak diisi`
 * - `[duplikat] baris sama persis dengan baris sebelumnya`
 * Jika tidak cocok persis dengan pola di atas, kembalikan `"-"` (jangan menebak - Penyesuaian Wajib butir f).
 */
function extractStrictBeforeValueFromBackendAlasan(alasan: string): string {
  const trimmed = alasan.trim();

  // 1. Pola Outlier: "[outlier] nilai 99999 di luar rentang..." atau "[outlier] nilai 99999 z-score..."
  const outlierMatch = trimmed.match(
    /^\[outlier\]\s+nilai\s+([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(?:di luar rentang wajar|z-score)\b/
  );
  if (outlierMatch) {
    const num = Number(outlierMatch[1]);
    if (Number.isFinite(num)) {
      return `${formatNumberId(num, 4)} (Outlier)`;
    }
  }

  // 2. Pola Format: "[format] nilai 'abc' bukan angka"
  const formatMatch = trimmed.match(
    /^\[format\]\s+nilai\s+'(.*)'\s+bukan angka$/
  );
  if (formatMatch) {
    return `'${formatMatch[1]}' (Format Bukan Angka)`;
  }

  // 3. Pola Kosong: "[kosong] nilai tidak diisi"
  if (trimmed === '[kosong] nilai tidak diisi') {
    return '(Kosong)';
  }

  // 4. Pola Duplikat: "[duplikat] baris sama persis dengan baris sebelumnya"
  if (trimmed === '[duplikat] baris sama persis dengan baris sebelumnya') {
    return '(Baris Duplikat)';
  }

  return '-';
}

/**
 * Panel Perbandingan Sebelum vs Sesudah Permanen di Bawah Grid Review (F-17)
 * Mematuhi Aturan Konten Fase 4 dan Penyesuaian Wajib butir c & f:
 * - Menampilkan HANYA angka yang benar-benar tersedia dari backend.
 * - Tidak menampilkan perkiraan kelengkapan setelah review atau persen "perbaikan mutu".
 * - Kartu kelengkapan diberi keterangan: "Dihitung saat pembersihan terakhir; belum memperhitungkan edit dan review sesudahnya".
 * - Tanpa klaim "Telah Diverifikasi" atau "siap dikomit".
 * - Tabel perbandingan dibatasi ke item yang sudah ditinjau (Diperbaiki, Ditolak, Diterima) dengan paginasi 10 per halaman dan filter status.
 */
export const ReviewImpactComparisonPanel: React.FC<
  ReviewImpactComparisonPanelProps
> = ({
  dataset,
  cleanReport,
  editsResponse,
  applyPreviewData,
  rejectedClassification,
  allLoadedAnomalies,
  isRowMappingValid,
  rowByRowIndex,
  onOpenAuditDrawer,
}) => {
  const [filterStatus, setFilterStatus] = useState<DiffFilterStatus>('semua');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10; // Paginasi 10 per halaman sesuai Penyesuaian Wajib butir f

  useEffect(() => {
    setPage(1);
  }, [filterStatus]);

  // Susun daftar baris tabel perbandingan dari riwayat edit (GET /edits) dan anomali yang telah ditinjau
  const allDiffRows: DiffTableRowItem[] = useMemo(() => {
    const items: DiffTableRowItem[] = [];
    const editsList = editsResponse?.data || [];

    // Catat sel (row_index::kolom) yang sudah ada di riwayat edit agar tidak terduplikasi dengan anomali 'diperbaiki'
    const editedCellKeys = new Set<string>();

    // 1. Masukkan seluruh koreksi sel manual dari GET /datasets/{id}/edits
    for (const edit of editsList) {
      const cellKey = `${edit.row_index}::${edit.kolom}`;
      editedCellKeys.add(cellKey);

      items.push({
        key: `edit-${edit.id}`,
        rowIndex: edit.row_index,
        barisDiFileAsli: edit.baris_di_file_asli,
        kolom: edit.kolom,
        nilaiSebelum: formatCellValueId(edit.nilai_lama),
        nilaiSesudah: formatCellValueId(edit.nilai_baru),
        statusType: 'diperbaiki',
        alasanText: edit.alasan,
        versiInfo: `v${edit.versi_baru}`,
      });
    }

    // 2. Masukkan anomali yang telah ditinjau (ditolak, diterima, atau diperbaiki yang belum tercakup di batch edits)
    for (const anom of allLoadedAnomalies) {
      if (anom.status === 'pending') continue;

      const cellKey = `${anom.row_index}::${anom.kolom}`;
      if (anom.status === 'diperbaiki' && editedCellKeys.has(cellKey)) {
        continue;
      }

      const verifiedRow = isRowMappingValid
        ? rowByRowIndex[anom.row_index]
        : undefined;
      const hasVerifiedCellValue =
        verifiedRow !== undefined &&
        anom.kolom !== '*' &&
        anom.kolom in verifiedRow.data;
      const verifiedCellValue = hasVerifiedCellValue
        ? verifiedRow.data[anom.kolom]
        : undefined;

      if (anom.status === 'ditolak') {
        const isAlreadyDropped =
          rejectedClassification.alreadyDroppedRowIndices.has(anom.row_index);
        const isActiveRejected =
          rejectedClassification.activeRejectedRowIndices.has(anom.row_index);

        const beforeVal = extractStrictBeforeValueFromBackendAlasan(
          anom.alasan
        );

        let afterVal = '[Akan Dibuang pada Terapkan Review]';
        let statusType: DiffTableRowItem['statusType'] = 'ditolak_aktif';

        if (isAlreadyDropped) {
          afterVal = `[Sudah Dibuang (v${dataset?.versi_bersih ?? 1})]`;
          statusType = 'ditolak_dibuang';
        } else if (!isActiveRejected && !rejectedClassification.isCertain) {
          afterVal = '[Ditolak]';
          statusType = 'ditolak_aktif';
        }

        items.push({
          key: `anom-${anom.id}`,
          rowIndex: anom.row_index,
          barisDiFileAsli: anom.baris_di_file_asli,
          kolom: anom.kolom === '*' ? '(seluruh baris)' : anom.kolom,
          nilaiSebelum: beforeVal,
          nilaiSesudah: afterVal,
          statusType,
          alasanText: anom.alasan,
          versiInfo: null,
        });
      } else if (anom.status === 'diterima') {
        const beforeVal = extractStrictBeforeValueFromBackendAlasan(
          anom.alasan
        );
        const afterVal = hasVerifiedCellValue
          ? `${formatCellValueId(verifiedCellValue)} (Dipertahankan)`
          : 'Dipertahankan';

        items.push({
          key: `anom-${anom.id}`,
          rowIndex: anom.row_index,
          barisDiFileAsli: anom.baris_di_file_asli,
          kolom: anom.kolom === '*' ? '(seluruh baris)' : anom.kolom,
          nilaiSebelum: beforeVal,
          nilaiSesudah: afterVal,
          statusType: 'diterima',
          alasanText: anom.alasan,
          versiInfo: null,
        });
      } else if (anom.status === 'diperbaiki') {
        const beforeVal = extractStrictBeforeValueFromBackendAlasan(
          anom.alasan
        );
        const afterVal = hasVerifiedCellValue
          ? formatCellValueId(verifiedCellValue)
          : '-';

        items.push({
          key: `anom-${anom.id}`,
          rowIndex: anom.row_index,
          barisDiFileAsli: anom.baris_di_file_asli,
          kolom: anom.kolom === '*' ? '(seluruh baris)' : anom.kolom,
          nilaiSebelum: beforeVal,
          nilaiSesudah: afterVal,
          statusType: 'diperbaiki',
          alasanText: anom.alasan,
          versiInfo: null,
        });
      }
    }

    // Urutkan berdasarkan nomor baris file asli terkecil
    items.sort((a, b) => a.barisDiFileAsli - b.barisDiFileAsli);
    return items;
  }, [
    editsResponse,
    allLoadedAnomalies,
    isRowMappingValid,
    rowByRowIndex,
    rejectedClassification,
    dataset?.versi_bersih,
  ]);

  const countsByDiffType = useMemo(() => {
    let diperbaiki = 0;
    let ditolakAktif = 0;
    let ditolakDibuang = 0;
    let diterima = 0;
    for (const r of allDiffRows) {
      if (r.statusType === 'diperbaiki') diperbaiki += 1;
      else if (r.statusType === 'ditolak_aktif') ditolakAktif += 1;
      else if (r.statusType === 'ditolak_dibuang') ditolakDibuang += 1;
      else if (r.statusType === 'diterima') diterima += 1;
    }
    return {
      semua: allDiffRows.length,
      diperbaiki,
      ditolakAktif,
      ditolakDibuang,
      diterima,
    };
  }, [allDiffRows]);

  const filteredDiffRows = useMemo(() => {
    if (filterStatus === 'semua') return allDiffRows;
    return allDiffRows.filter((r) => r.statusType === filterStatus);
  }, [allDiffRows, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredDiffRows.length / pageSize));
  const pagedDiffRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDiffRows.slice(start, start + pageSize);
  }, [filteredDiffRows, page, pageSize]);

  const activeBarisDibuang = applyPreviewData?.baris_dibuang ?? 0;
  const barisSaatIni =
    applyPreviewData?.baris_sebelum ?? dataset?.baris_bersih ?? 0;
  const barisSesudahPratinjau =
    applyPreviewData?.baris_sesudah ?? dataset?.baris_bersih ?? 0;

  const editsSummary = editsResponse?.ringkasan;
  const jumlahPerubahanManual =
    editsSummary?.jumlah_perubahan ?? dataset?.jumlah_edit_manual ?? 0;

  return (
    <section
      aria-labelledby="panel-diff-comparison-title"
      className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark overflow-hidden"
    >
      {/* Header Panel Perbandingan Permanen */}
      <div className="px-5 py-4 bg-header-light/60 dark:bg-header-dark/60 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileDiff className="w-5 h-5 text-brand-primary-light dark:text-brand-primary-dark" />
          <div>
            <h3
              id="panel-diff-comparison-title"
              className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark"
            >
              Perbandingan Dampak Sebelum & Sesudah Review
            </h3>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Rincian dampak pembuangan baris ditolak dan koreksi nilai sel manual berdasarkan data backend.
            </p>
          </div>
        </div>

        {/* Status Faktual Tanpa Klaim "Siap Dikomit" */}
        <div className="text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
          {activeBarisDibuang > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark font-semibold">
              <span>
                {formatNumberId(activeBarisDibuang, 0)} baris ditolak menunggu
                diterapkan ke v{(dataset?.versi_bersih ?? 1) + 1}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
              <span>
                Versi Bersih Aktif: v{dataset?.versi_bersih ?? 1} (Tidak ada
                baris ditolak yang menunggu dibuang)
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* TIGA KARTU METRIK FAKTUAL (Tanpa Estimasi Kelengkapan Pasca-Review & Tanpa Klaim "Telah Diverifikasi") */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kartu 1: Total Baris Data (Dari Pratinjau Apply Review / Detail Dataset) */}
          <div className="p-4 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-brand-primary-light dark:text-brand-primary-dark" />
                <span>Total Baris Data Bersih</span>
              </span>
              {activeBarisDibuang > 0 ? (
                <div className="text-2xl font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark flex items-center gap-2 pt-0.5">
                  <span>{formatNumberId(barisSaatIni, 0)}</span>
                  <ArrowRight className="w-5 h-5 text-text-muted-light dark:text-text-muted-dark" />
                  <span className="text-brand-primary-light dark:text-brand-primary-dark">
                    {formatNumberId(barisSesudahPratinjau, 0)}
                  </span>
                </div>
              ) : (
                <div className="text-2xl font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark pt-0.5">
                  {formatNumberId(dataset?.baris_bersih ?? 0, 0)}{' '}
                  <span className="text-xs font-normal text-text-secondary-light dark:text-text-secondary-dark">
                    baris aktif (v{dataset?.versi_bersih ?? 1})
                  </span>
                </div>
              )}
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark tabular-numbers">
                {activeBarisDibuang > 0
                  ? `Pratinjau v${dataset?.versi_bersih ?? 1} → v${
                      (dataset?.versi_bersih ?? 1) + 1
                    } jika review diterapkan`
                  : `Baris mentah awal: ${formatNumberId(
                      dataset?.baris_mentah ?? cleanReport?.baris_awal ?? 0,
                      0
                    )} baris • Review diterapkan: ${formatNumberId(
                      dataset?.jumlah_review_diterapkan ?? 0,
                      0
                    )} kali`}
              </p>
            </div>

            {activeBarisDibuang > 0 && (
              <span className="px-2.5 py-1 rounded-button text-xs font-mono font-bold tabular-numbers bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 whitespace-nowrap">
                -{formatNumberId(activeBarisDibuang, 0)} Baris Ditolak
              </span>
            )}
          </div>

          {/* Kartu 2: Perubahan Manual (Dari GET /datasets/{id}/edits & GET /datasets/{id}) */}
          <div className="p-4 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark" />
                <span>Perubahan Manual</span>
              </span>
              <div className="text-2xl font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark pt-0.5">
                {formatNumberId(jumlahPerubahanManual, 0)}{' '}
                <span className="text-sm font-semibold">Perubahan</span>
              </div>
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark tabular-numbers">
                {editsSummary
                  ? `${formatNumberId(editsSummary.sel_unik, 0)} sel unik pada ${formatNumberId(
                      editsSummary.baris_unik,
                      0
                    )} baris data`
                  : 'Total perubahan nilai sel manual'}
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAuditDrawer}
              className="px-2.5 py-1 rounded-button text-xs font-semibold bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Lihat Audit Log
            </button>
          </div>

          {/* Kartu 3: Tingkat Kelengkapan Data Saat Ini (Hanya Angka Faktual dari clean-report - Butir f) */}
          <div className="p-4 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-anomaly-success-text-light dark:text-anomaly-success-text-dark" />
              <span>Tingkat Kelengkapan Data</span>
            </span>
            <div className="text-2xl font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark pt-0.5">
              {cleanReport
                ? formatPercentId(cleanReport.kelengkapan_persen)
                : '-'}
            </div>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark leading-snug">
              Dihitung saat pembersihan terakhir; belum memperhitungkan edit dan
              review sesudahnya.
            </p>
          </div>
        </div>

        {/* Catatan Netral jika Klasifikasi Anomali Ditolak Tidak Dapat Dipastikan 100% (Butir c) */}
        {!rejectedClassification.isCertain &&
          rejectedClassification.message && (
            <div className="p-3 rounded-card bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
              <Info className="w-4 h-4 text-brand-cyan flex-shrink-0" />
              <span>{rejectedClassification.message}</span>
            </div>
          )}

        {/* Filter Status Tabel Perbandingan */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mr-1">
              Filter Item Ditinjau:
            </span>
            {(
              [
                {
                  id: 'semua',
                  label: `Semua Ditinjau (${formatNumberId(
                    countsByDiffType.semua,
                    0
                  )})`,
                },
                {
                  id: 'ditolak_aktif',
                  label: `Ditolak Aktif (${formatNumberId(
                    countsByDiffType.ditolakAktif,
                    0
                  )})`,
                },
                {
                  id: 'ditolak_dibuang',
                  label: `Ditolak - Sudah Dibuang (${formatNumberId(
                    countsByDiffType.ditolakDibuang,
                    0
                  )})`,
                },
                {
                  id: 'diperbaiki',
                  label: `Diperbaiki (${formatNumberId(
                    countsByDiffType.diperbaiki,
                    0
                  )})`,
                },
                {
                  id: 'diterima',
                  label: `Diterima (${formatNumberId(
                    countsByDiffType.diterima,
                    0
                  )})`,
                },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterStatus(pill.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[34px] tabular-numbers ${
                  filterStatus === pill.id
                    ? 'bg-text-primary-light text-surface-light dark:bg-text-primary-dark dark:text-canvas-dark'
                    : 'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-text-muted-light dark:text-text-muted-dark tabular-numbers">
            Menampilkan item yang telah ditinjau (maks. 10 baris per halaman)
          </span>
        </div>

        {/* Tabel Perbandingan (Baris File Asli, Kolom, Nilai Sebelum, Nilai Sesudah, Status Akhir, Alasan, Tautan Audit Log) */}
        <div className="rounded-card border border-border-light dark:border-border-dark overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                  <th
                    className="py-3 px-4 whitespace-nowrap"
                    title="Nomor baris pada file CSV/Excel asli (row_index + 2)"
                  >
                    No. Baris File
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Nama Kolom</th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    Nilai Sebelum Review
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    Nilai Sesudah Review
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap">Status Akhir</th>
                  <th className="py-3 px-4">
                    Alasan Perubahan / Alasan Anomali
                  </th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                {pagedDiffRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-sm text-text-muted-light dark:text-text-muted-dark"
                    >
                      Belum ada item anomali yang ditinjau (Diterima, Ditolak,
                      atau Diperbaiki) sesuai filter ini.
                    </td>
                  </tr>
                ) : (
                  pagedDiffRows.map((item) => {
                    const isRejected =
                      item.statusType === 'ditolak_aktif' ||
                      item.statusType === 'ditolak_dibuang';

                    return (
                      <tr
                        key={item.key}
                        className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50 transition-colors"
                      >
                        {/* 1. Baris File Asli */}
                        <td className="py-3 px-4 font-mono text-xs font-bold tabular-numbers whitespace-nowrap align-top text-text-primary-light dark:text-text-primary-dark">
                          <span>#{item.barisDiFileAsli}</span>
                          {item.versiInfo && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark">
                              {item.versiInfo}
                            </span>
                          )}
                        </td>

                        {/* 2. Nama Kolom */}
                        <td className="py-3 px-4 font-mono text-xs font-semibold whitespace-nowrap align-top text-brand-primary-light dark:text-brand-primary-dark">
                          {item.kolom}
                        </td>

                        {/* 3. Nilai Sebelum */}
                        <td className="py-3 px-4 font-mono text-xs tabular-numbers whitespace-nowrap align-top">
                          {item.nilaiSebelum === '-' ? (
                            <span className="text-text-muted-light dark:text-text-muted-dark">
                              -
                            </span>
                          ) : (
                            <span className="text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                              {item.nilaiSebelum}
                            </span>
                          )}
                        </td>

                        {/* 4. Nilai Sesudah */}
                        <td className="py-3 px-4 font-mono text-xs font-bold tabular-numbers whitespace-nowrap align-top">
                          {isRejected ? (
                            <span className="px-2 py-0.5 rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark line-through">
                              {item.nilaiSesudah}
                            </span>
                          ) : item.statusType === 'diperbaiki' ? (
                            <span className="px-2 py-0.5 rounded-button bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark">
                              {item.nilaiSesudah}
                            </span>
                          ) : (
                            <span className="text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                              {item.nilaiSesudah}
                            </span>
                          )}
                        </td>

                        {/* 5. Status Akhir */}
                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          {item.statusType === 'diperbaiki' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-button text-xs font-semibold bg-modified-bg-light dark:bg-modified-bg-dark border-l-audit border-l-modified-border-light dark:border-l-modified-border-dark text-text-primary-light dark:text-text-primary-dark">
                              <Edit3 className="w-3.5 h-3.5 text-modified-border-light dark:text-modified-border-dark" />
                              <span>Diperbaiki</span>
                            </span>
                          )}
                          {item.statusType === 'ditolak_aktif' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark line-through">
                              <X className="w-3.5 h-3.5" />
                              <span>Ditolak (Aktif)</span>
                            </span>
                          )}
                          {item.statusType === 'ditolak_dibuang' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark line-through">
                              <X className="w-3.5 h-3.5" />
                              <span>
                                Sudah dibuang (v{dataset?.versi_bersih ?? 1})
                              </span>
                            </span>
                          )}
                          {item.statusType === 'diterima' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                              <Check className="w-3.5 h-3.5" />
                              <span>Diterima</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Alasan */}
                        <td className="py-3 px-4 text-xs font-mono text-text-primary-light dark:text-text-primary-dark align-top">
                          {item.alasanText}
                        </td>

                        {/* 7. Tautan ke Audit Log */}
                        <td className="py-3 px-4 whitespace-nowrap align-top text-right">
                          <button
                            type="button"
                            onClick={onOpenAuditDrawer}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-xs font-semibold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-[34px]"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Audit Log</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Paginasi 10 per Halaman */}
          <div className="px-5 py-3 bg-header-light/50 dark:bg-header-dark/50 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
              Menampilkan{' '}
              <strong>
                {filteredDiffRows.length === 0
                  ? 0
                  : (page - 1) * pageSize + 1}
                –{Math.min(page * pageSize, filteredDiffRows.length)}
              </strong>{' '}
              dari <strong>{formatNumberId(filteredDiffRows.length, 0)}</strong>{' '}
              item yang telah ditinjau
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Halaman perbandingan sebelumnya"
                className="p-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 rounded-button bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark font-mono font-bold tabular-numbers">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Halaman perbandingan berikutnya"
                className="p-1.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
