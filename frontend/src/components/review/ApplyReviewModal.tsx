import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BACKEND_CAPABILITIES } from '@/config/backendCapabilities';
import { postApplyReview } from '@/services/datasetService';
import { AnomalyItem, ApplyReviewResponse } from '@/types/dataset';
import { formatCellValueId, formatNumberId } from '@/utils/formatters';
import { VerifiedCleanRow } from '@/utils/rowIndexMapper';

export interface ApplyReviewSuccessPayload {
  /** Respons dari POST apply-review?preview=false */
  executionResponse: ApplyReviewResponse;
  /** Snapshot pratinjau terakhir yang disetujui pengguna sebelum eksekusi */
  approvedPreviewSnapshot: ApplyReviewResponse;
  /** Apakah terdapat perbedaan jumlah antara pratinjau yang disetujui dan hasil eksekusi */
  hasPostExecutionDrift: boolean;
  /** Penjelasan perbedaan jika hasPostExecutionDrift === true */
  driftDescription: string | null;
}

interface ApplyReviewModalProps {
  isOpen: boolean;
  datasetId: string;
  /** Seluruh item anomali yang telah dimuat untuk pemetaan kolom pada baris yang dibuang */
  allLoadedAnomalies: AnomalyItem[];
  /** Apakah pemetaan baris di grid terverifikasi 100% valid */
  isRowMappingValid: boolean;
  /** Peta row_index -> VerifiedCleanRow (hanya dipakai jika isRowMappingValid === true) */
  rowByRowIndex: Record<number, VerifiedCleanRow>;
  /** Callback saat modal ditutup / dibatalkan */
  onClose: () => void;
  /** Callback untuk menyegarkan query di induk bila terjadi error / drift */
  onInvalidateData: () => Promise<void>;
  /** Callback saat eksekusi preview=false berhasil */
  onApplySuccess: (payload: ApplyReviewSuccessPayload) => Promise<void>;
}

/**
 * Modal Konfirmasi Dua Langkah "Terapkan Hasil Review" (F-17)
 * Mematuhi seluruh aturan keselamatan aksi merusak (Penyesuaian Wajib a, b, g):
 * - Langkah 1 mengambil data SEGAR dari POST /datasets/{id}/apply-review?preview=true saat dibuka.
 * - Menampilkan dampak baris (sebelum, dibuang, sesudah), catatan anomali pending, peringatan stale forecast,
 *   dan daftar baris yang akan dibuang dengan coretan merah.
 * - Teks jujur mengenai ketiadaan fitur pemulihan versi lama di aplikasi.
 * - Langkah 2 mewajibkan kotak centang persetujuan, menempatkan fokus awal pada tombol Batal (bukan tombol konfirmasi),
 *   dan menjalankan PRA-CEK SEGAR (preview=true) sebelum memanggil preview=false.
 *   (Catatan arsitektur: Backend tidak memiliki parameter pengaman versi seperti expected_version pada
 *   endpoint apply-review, sehingga pra-cek di sisi klien ini berfungsi sebagai mitigasi terhadap perubahan
 *   data antar-tab/sesi sebelum eksekusi).
 */
export const ApplyReviewModal: React.FC<ApplyReviewModalProps> = ({
  isOpen,
  datasetId,
  allLoadedAnomalies,
  isRowMappingValid,
  rowByRowIndex,
  onClose,
  onInvalidateData,
  onApplySuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<ApplyReviewResponse | null>(
    null
  );
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Peringatan jika pra-cek sebelum eksekusi mendeteksi perubahan data dan mengembalikan pengguna ke Langkah 1
  const [preCheckDriftWarning, setPreCheckDriftWarning] = useState<
    string | null
  >(null);

  // Error saat eksekusi Langkah 2 (ditampilkan di dalam modal tanpa toast ganda sesuai butir g)
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Kotak centang persetujuan wajib di Langkah 2 (butir b)
  const [isConsentChecked, setIsConsentChecked] = useState<boolean>(false);

  // Status sedang memproses pra-cek + eksekusi (mengunci seluruh tombol untuk mencegah klik ganda)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitPhaseLabel, setSubmitPhaseLabel] = useState<string>(
    'Memproses...'
  );

  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const step1CancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const step2CancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Fungsi memuat pratinjau segar dari backend
  const fetchFreshPreview = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    setExecutionError(null);
    try {
      const fresh = await postApplyReview(datasetId, true);
      setPreviewData(fresh);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } };
        localizedMessage?: string;
      };
      const serverDetail =
        axiosErr?.response?.data?.detail ||
        axiosErr?.localizedMessage ||
        'Gagal memuat pratinjau penerapan hasil review dari server.';
      setPreviewData(null);
      setPreviewError(serverDetail);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Saat modal dibuka: simpan elemen pemicu, reset state ke Langkah 1, dan ambil pratinjau SEGAR
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current =
        document.activeElement as HTMLElement | null;
      setStep(1);
      setPreviewData(null);
      setPreviewError(null);
      setPreCheckDriftWarning(null);
      setExecutionError(null);
      setIsConsentChecked(false);
      setIsSubmitting(false);
      void fetchFreshPreview();
    } else if (previousActiveElementRef.current) {
      // Kembalikan fokus ke tombol pemicu saat modal ditutup (butir b)
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, datasetId]);

  // Atur fokus awal di setiap langkah (di Langkah 2 wajib fokus ke tombol Batal, BUKAN tombol konfirmasi)
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (step === 1) {
        step1CancelBtnRef.current?.focus();
      } else {
        step2CancelBtnRef.current?.focus();
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOpen, step, isLoadingPreview]);

  // Kunci fokus (Focus Trap) dan penanganan tombol Escape di dalam modal (butir b)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isSubmitting) {
          onClose();
        }
        return;
      }

      if (e.key === 'Tab' && modalContainerRef.current) {
        const focusableElements =
          modalContainerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
          );
        if (focusableElements.length === 0) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Peta row_index -> daftar nama kolom beranomali 'ditolak'
  const rejectedColumnsByRowIndex = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const a of allLoadedAnomalies) {
      if (a.status === 'ditolak') {
        const list = map.get(a.row_index) || [];
        const label = a.kolom === '*' ? '(seluruh baris)' : a.kolom;
        if (!list.includes(label)) {
          list.push(label);
        }
        map.set(a.row_index, list);
      }
    }
    return map;
  }, [allLoadedAnomalies]);

  // Peta row_index -> row_json dari respons B-06 (jika saklar B06_APPLY_REVIEW_DIFF_ROWS aktif)
  const b06RowDataByRowIndex = useMemo(() => {
    const map = new Map<number, Record<string, unknown>>();
    if (!BACKEND_CAPABILITIES.B06_APPLY_REVIEW_DIFF_ROWS || !previewData) {
      return map;
    }
    for (const item of previewData.detail_baris_dibuang) {
      if (item.row_json) {
        map.set(item.row_index, item.row_json);
      }
    }
    if (previewData.rows) {
      for (const r of previewData.rows) {
        const rData = r.row_json || r.data;
        if (rData) {
          map.set(r.row_index, rData);
        }
      }
    }
    return map;
  }, [previewData]);

  /**
   * PENYESUAIAN WAJIB BUTIR a & g:
   * Saat tombol konfirmasi akhir di Langkah 2 ditekan:
   * 1. Jangan langsung memanggil preview=false.
   *    (Catatan: Backend tidak memiliki pengaman versi expected_version, sehingga pra-cek ini
   *    merupakan mitigasi klien agar tidak membuang baris yang salah jika data berubah di antara Langkah 1 dan 2).
   * 2. Panggil ulang POST apply-review?preview=true secara segar.
   * 3. Bandingkan baris_dibuang, baris_sesudah, dan versi_lama dengan snapshot Langkah 1.
   * 4. Jika BERBEDA atau pratinjau gagal: JANGAN eksekusi. Kembali ke Langkah 1 dengan data baru,
   *    tampilkan peringatan yang menjelaskan perbedaannya, dan wajibkan konfirmasi ulang dari awal.
   * 5. Jika SAMA: lanjut memanggil POST apply-review?preview=false.
   * 6. Bandingkan juga respons preview=false dengan snapshot pratinjau sesudah eksekusi.
   */
  const handleFinalConfirmExecution = async () => {
    if (!previewData || !isConsentChecked || isSubmitting) return;

    const snapshot = previewData;
    setIsSubmitting(true);
    setExecutionError(null);
    setSubmitPhaseLabel('Memeriksa kesegaran data sebelum eksekusi...');

    // Langkah Pra-Cek 1: Panggil ulang POST apply-review?preview=true secara segar
    let preCheckPreview: ApplyReviewResponse;
    try {
      preCheckPreview = await postApplyReview(datasetId, true);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } };
        localizedMessage?: string;
      };
      const detail =
        axiosErr?.response?.data?.detail ||
        axiosErr?.localizedMessage ||
        'Gagal memverifikasi pratinjau terbaru sebelum eksekusi.';
      // Kembali ke Langkah 1 dengan pesan error dan segarkan data induk
      setIsSubmitting(false);
      setIsConsentChecked(false);
      setStep(1);
      setPreviewData(null);
      setPreviewError(detail);
      setPreCheckDriftWarning(
        `Eksekusi dibatalkan demi keselamatan data karena kondisi dataset telah berubah: ${detail}`
      );
      await onInvalidateData();
      return;
    }

    // Langkah Pra-Cek 2: Bandingkan baris_dibuang, baris_sesudah, dan versi_lama dengan snapshot Langkah 1
    const isSameImpact =
      preCheckPreview.versi_lama === snapshot.versi_lama &&
      preCheckPreview.baris_dibuang === snapshot.baris_dibuang &&
      preCheckPreview.baris_sesudah === snapshot.baris_sesudah;

    if (!isSameImpact) {
      // Langkah Pra-Cek 3: BERBEDA -> JANGAN eksekusi, kembali ke Langkah 1 dengan data baru
      const diffParts: string[] = [];
      if (preCheckPreview.versi_lama !== snapshot.versi_lama) {
        diffParts.push(
          `Versi data bersih berubah dari v${snapshot.versi_lama} menjadi v${preCheckPreview.versi_lama}`
        );
      }
      if (preCheckPreview.baris_dibuang !== snapshot.baris_dibuang) {
        diffParts.push(
          `Jumlah baris yang akan dibuang berubah dari ${formatNumberId(
            snapshot.baris_dibuang,
            0
          )} menjadi ${formatNumberId(preCheckPreview.baris_dibuang, 0)} baris`
        );
      }
      if (preCheckPreview.baris_sesudah !== snapshot.baris_sesudah) {
        diffParts.push(
          `Sisa baris bersih berubah dari ${formatNumberId(
            snapshot.baris_sesudah,
            0
          )} menjadi ${formatNumberId(preCheckPreview.baris_sesudah, 0)} baris`
        );
      }

      setIsSubmitting(false);
      setIsConsentChecked(false);
      setPreviewData(preCheckPreview);
      setStep(1);
      setPreCheckDriftWarning(
        `Eksekusi DIBLOKIR karena data berubah di antara pratinjau dan konfirmasi (${diffParts.join(
          '; '
        )}). Silakan periksa kembali dampak terbaru di Langkah 1 dan konfirmasi ulang dari awal.`
      );
      await onInvalidateData();
      return;
    }

    // Langkah Eksekusi: Pra-cek cocok -> panggil POST apply-review?preview=false
    setSubmitPhaseLabel(
      `Membuang ${formatNumberId(
        snapshot.baris_dibuang,
        0
      )} baris & membuat v${snapshot.versi_lama + 1}...`
    );

    try {
      const execRes = await postApplyReview(datasetId, false);
      const expectedNewVersion = snapshot.versi_lama + 1;
      const hasPostDrift =
        execRes.baris_dibuang !== snapshot.baris_dibuang ||
        execRes.baris_sesudah !== snapshot.baris_sesudah ||
        (execRes.versi_baru !== null &&
          execRes.versi_baru !== expectedNewVersion);

      let driftDesc: string | null = null;
      if (hasPostDrift) {
        driftDesc = `Perhatian: Terdapat perbedaan antara pratinjau (membuang ${formatNumberId(
          snapshot.baris_dibuang,
          0
        )} baris -> sisa ${formatNumberId(
          snapshot.baris_sesudah,
          0
        )} baris pada v${expectedNewVersion}) dan hasil eksekusi akhir (membuang ${formatNumberId(
          execRes.baris_dibuang,
          0
        )} baris -> sisa ${formatNumberId(
          execRes.baris_sesudah,
          0
        )} baris pada v${execRes.versi_baru ?? expectedNewVersion}).`;
      }

      setIsSubmitting(false);
      await onApplySuccess({
        executionResponse: execRes,
        approvedPreviewSnapshot: snapshot,
        hasPostExecutionDrift: hasPostDrift,
        driftDescription: driftDesc,
      });
    } catch (err: unknown) {
      // Butir g: Jika POST preview=false mengembalikan error 400 (misalnya sudah diterapkan oleh sesi lain),
      // tampilkan pesan jelas di dalam modal (bukan toast ganda), segarkan data, dan jangan mengulang otomatis.
      const axiosErr = err as {
        response?: { status?: number; data?: { detail?: string } };
        localizedMessage?: string;
      };
      const serverDetail =
        axiosErr?.response?.data?.detail ||
        axiosErr?.localizedMessage ||
        'Gagal menerapkan hasil review ke versi data bersih baru.';
      setIsSubmitting(false);
      setExecutionError(serverDetail);
      await onInvalidateData();
    }
  };

  if (!isOpen) return null;

  const targetNewVersion = previewData ? previewData.versi_lama + 1 : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas-dark/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-apply-review-title"
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-4xl max-h-[90vh] rounded-modal bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header Modal Dua Langkah */}
        <div className="px-6 py-4 bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="modal-apply-review-title"
                  className="text-base font-bold text-text-primary-light dark:text-text-primary-dark"
                >
                  Terapkan Hasil Review (Pembuangan Baris Anomali Ditolak)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark">
                  Langkah {step} dari 2
                </span>
              </div>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                {step === 1
                  ? 'Langkah 1: Telaah dampak pembuangan baris dan daftar baris yang akan dikeluarkan dari versi data bersih baru.'
                  : 'Langkah 2: Konfirmasi akhir penghapusan baris dari versi data bersih baru.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog Terapkan Hasil Review"
            className="p-2 rounded-button text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors disabled:opacity-40 min-h-control"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-text-primary-light dark:text-text-primary-dark">
          {/* Banner Peringatan Pra-Cek jika data berubah di antara Langkah 1 dan Langkah 2 */}
          {preCheckDriftWarning && (
            <div
              role="alert"
              className="p-4 rounded-card bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border-2 border-anomaly-danger-text-light dark:border-anomaly-danger-text-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex items-start gap-3"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="font-bold">
                  Perubahan Data Terdeteksi Saat Pra-Cek Keselamatan
                </div>
                <p>{preCheckDriftWarning}</p>
              </div>
            </div>
          )}

          {/* Banner Peringatan Jujur Mengenai Sifat Merusak & Ketiadaan Fitur Pemulihan Versi Lama (Butir b) */}
          <div className="p-4 rounded-card bg-anomaly-warning-bg-light/70 dark:bg-anomaly-warning-bg-dark/60 border border-anomaly-warning-text-light/30 dark:border-anomaly-warning-text-dark/40 text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-bold text-sm">
                Peringatan Tindakan Merusak (Tidak Dapat Dibatalkan)
              </div>
              <p>
                Seluruh baris yang memiliki anomali berstatus{' '}
                <strong>Ditolak</strong> akan{' '}
                <strong>dibuang dari versi data bersih baru</strong>. Versi data
                bersih sebelumnya tetap tersimpan di server sebagai arsip,{' '}
                <strong>
                  tetapi aplikasi ini belum memiliki fitur untuk memulihkan atau
                  kembali ke versi sebelumnya
                </strong>
                . Satu-satunya cara memulihkan baris yang sudah dibuang adalah
                menjalankan <strong>Pembersihan Otomatis Ulang</strong> dari
                data mentah (v0) yang akan menimpa seluruh edit manual dan hasil
                review Anda.
              </p>
            </div>
          </div>

          {/* Kondisi Memuat Pratinjau Segar */}
          {isLoadingPreview ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-primary-light dark:text-brand-primary-dark" />
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Mengambil perhitungan dampak terbaru dari server backend...
              </p>
            </div>
          ) : previewError ? (
            /* Kondisi Error Pratinjau (misal: 100% baris akan terbuang atau tidak ada anomali ditolak) */
            <div
              role="alert"
              className="p-5 rounded-card bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border border-anomaly-danger-text-light/40 dark:border-anomaly-danger-text-dark/40 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">
                    Penerapan Hasil Review Tidak Dapat Dilanjutkan
                  </h4>
                  <p className="text-sm leading-relaxed">{previewError}</p>
                  {previewError.toLowerCase().includes('semua baris') && (
                    <p className="text-xs opacity-90 pt-1">
                      Server memblokir pembuangan 100% baris agar dataset bersih tidak menjadi kosong. Silakan tinjau kembali status anomali pada tabel dan pertahankan minimal satu baris data.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => void fetchFreshPreview()}
                >
                  Muat Ulang Pratinjau
                </Button>
              </div>
            </div>
          ) : previewData ? (
            <>
              {/* KARTU METRIK DAMPAK (Ditampilkan di Langkah 1 & Langkah 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* 1. Transisi Versi Bersih */}
                <div className="p-3.5 rounded-card bg-header-light dark:bg-header-dark border border-border-light dark:border-border-dark">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark block">
                    Versi Data Bersih
                  </span>
                  <div className="text-lg font-bold font-mono tabular-numbers text-brand-primary-light dark:text-brand-primary-dark mt-1 flex items-center gap-1.5">
                    <span>v{previewData.versi_lama}</span>
                    <ArrowRight className="w-4 h-4" />
                    <span>v{targetNewVersion}</span>
                  </div>
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Versi aktif baru
                  </span>
                </div>

                {/* 2. Baris Sebelum */}
                <div className="p-3.5 rounded-card bg-canvas-light dark:bg-canvas-dark border border-border-light dark:border-border-dark">
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark block">
                    Baris Sebelum (v{previewData.versi_lama})
                  </span>
                  <div className="text-lg font-bold font-mono tabular-numbers text-text-primary-light dark:text-text-primary-dark mt-1">
                    {formatNumberId(previewData.baris_sebelum, 0)} baris
                  </div>
                  <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Jumlah baris saat ini
                  </span>
                </div>

                {/* 3. Baris Akan Dibuang */}
                <div className="p-3.5 rounded-card bg-anomaly-danger-bg-light/70 dark:bg-anomaly-danger-bg-dark/60 border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40">
                  <span className="text-xs font-semibold text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark block">
                    Baris Akan Dibuang
                  </span>
                  <div className="text-lg font-bold font-mono tabular-numbers text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark mt-1">
                    -{formatNumberId(previewData.baris_dibuang, 0)} baris
                  </div>
                  <span className="text-xs text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark font-mono tabular-numbers">
                    Dari {formatNumberId(previewData.anomali_ditolak_diterapkan, 0)}{' '}
                    anomali ditolak
                  </span>
                </div>

                {/* 4. Baris Sesudah */}
                <div className="p-3.5 rounded-card bg-anomaly-success-bg-light/60 dark:bg-anomaly-success-bg-dark/50 border border-anomaly-success-text-light/30 dark:border-anomaly-success-text-dark/40">
                  <span className="text-xs font-semibold text-anomaly-success-text-light dark:text-anomaly-success-text-dark block">
                    Baris Sesudah (v{targetNewVersion})
                  </span>
                  <div className="text-lg font-bold font-mono tabular-numbers text-anomaly-success-text-light dark:text-anomaly-success-text-dark mt-1">
                    {formatNumberId(previewData.baris_sesudah, 0)} baris
                  </div>
                  <span className="text-xs text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
                    Dipertahankan di v{targetNewVersion}
                  </span>
                </div>
              </div>

              {/* Catatan Anomali Pending & Peringatan Backend */}
              <div className="p-3.5 rounded-card bg-header-light/60 dark:bg-header-dark/60 border border-border-light dark:border-border-dark space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-text-primary-light dark:text-text-primary-dark">
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan flex-shrink-0" />
                  <span>
                    Anomali Pending yang Tetap Dipertahankan:{' '}
                    <strong className="font-mono tabular-numbers">
                      {formatNumberId(previewData.anomali_pending, 0)} anomali
                    </strong>{' '}
                    (baris dengan anomali Pending, Diterima, atau Diperbaiki
                    tanpa anomali Ditolak tetap dipertahankan).
                  </span>
                </div>
                {previewData.peringatan.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-text-secondary-light dark:text-text-secondary-dark pl-1">
                    {previewData.peringatan.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                )}
              </div>

              {step === 1 ? (
                /* ============================================================
                 * LANGKAH 1: DAFTAR BARIS YANG AKAN DIBUANG (TABEL DIFF VISUAL)
                 * ============================================================ */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                      Daftar Baris yang Akan Dibuang (
                      {formatNumberId(
                        previewData.detail_baris_dibuang.length,
                        0
                      )}{' '}
                      dari {formatNumberId(previewData.baris_dibuang, 0)} Baris)
                    </h4>
                    {previewData.detail_terpotong && (
                      <span className="text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark font-semibold">
                        Menampilkan 200 baris pertama yang akan dibuang (batas rincian respons server)
                      </span>
                    )}
                  </div>

                  <div className="rounded-card border border-border-light dark:border-border-dark overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse" aria-label="Daftar Baris yang Akan Dibuang pada Penerapan Review">
                      <thead>
                        <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0 z-10">
                          <th scope="col" className="py-3 px-4 whitespace-nowrap">
                            No. Baris
                          </th>
                          <th scope="col" className="py-3 px-4 whitespace-nowrap">
                            Kolom Ditolak
                          </th>
                          <th scope="col" className="py-3 px-4">Alasan Anomali Ditolak</th>
                          <th scope="col" className="py-3 px-4">
                            Isi Baris (Bila Terverifikasi)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
                        {previewData.detail_baris_dibuang.map((rowItem) => {
                          const cols =
                            rowItem.kolom ||
                            rejectedColumnsByRowIndex.get(rowItem.row_index) ||
                            [];
                          const b06Data = b06RowDataByRowIndex.get(
                            rowItem.row_index
                          );
                          const verifiedRowData =
                            b06Data ||
                            (isRowMappingValid
                              ? rowByRowIndex[rowItem.row_index]?.data
                              : undefined);

                          return (
                            <tr
                              key={rowItem.row_index}
                              className="bg-anomaly-danger-bg-light/50 dark:bg-anomaly-danger-bg-dark/40 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark"
                            >
                              <td className="py-2.5 px-4 font-bold whitespace-nowrap align-top">
                                <div className="inline-flex items-center gap-1.5 line-through">
                                  <X className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                  <span>#{formatNumberId(rowItem.baris_di_file_asli, 0)}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap align-top font-semibold line-through">
                                {cols.length > 0 ? cols.join(', ') : '-'}
                              </td>
                              <td className="py-2.5 px-4 align-top">
                                <ul className="space-y-1">
                                  {rowItem.alasan.map((al, idx) => (
                                    <li key={idx} className="line-through">
                                      {al}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                              <td className="py-2.5 px-4 align-top">
                                {verifiedRowData ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(verifiedRowData)
                                      .slice(0, 6)
                                      .map(([k, v]) => (
                                        <span
                                          key={k}
                                          className="px-2 py-0.5 rounded-button bg-surface-light/80 dark:bg-surface-dark/80 border border-anomaly-danger-text-light/25 dark:border-anomaly-danger-text-dark/30 line-through"
                                        >
                                          <strong>{k}:</strong>{' '}
                                          {formatCellValueId(v, k)}
                                        </span>
                                      ))}
                                  </div>
                                ) : (
                                  <span className="font-sans italic text-text-secondary-light dark:text-text-secondary-dark">
                                    Isi baris tidak ditampilkan karena berada di luar pratinjau terverifikasi saat ini
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* ============================================================
                 * LANGKAH 2: KONFIRMASI AKHIR & KOTAK CENTANG PERSETUJUAN WAJIB
                 * ============================================================ */
                <div className="space-y-4">
                  {/* Kotak Ringkasan Akhir Langkah 2 */}
                  <div className="p-5 rounded-card bg-anomaly-danger-bg-light/40 dark:bg-anomaly-danger-bg-dark/30 border-2 border-anomaly-danger-text-light/50 dark:border-anomaly-danger-text-dark/50 space-y-3">
                    <h4 className="text-sm font-bold text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                      <span>
                        Konfirmasi Akhir Pembuangan{' '}
                        {formatNumberId(previewData.baris_dibuang, 0)} Baris
                        Data
                      </span>
                    </h4>
                    <p className="text-xs sm:text-sm text-text-primary-light dark:text-text-primary-dark leading-relaxed">
                      Anda akan membuang{' '}
                      <strong className="font-mono tabular-numbers text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark">
                        {formatNumberId(previewData.baris_dibuang, 0)} baris
                      </strong>{' '}
                      dari{' '}
                      <strong className="font-mono">
                        Versi Bersih v{previewData.versi_lama}
                      </strong>{' '}
                      dan menetapkan{' '}
                      <strong className="font-mono">
                        Versi Bersih v{targetNewVersion}
                      </strong>{' '}
                      dengan sisa{' '}
                      <strong className="font-mono tabular-numbers">
                        {formatNumberId(previewData.baris_sesudah, 0)} baris
                      </strong>
                      .
                    </p>

                    {/* Kotak Centang Persetujuan Wajib (Penyesuaian Wajib butir b) */}
                    <label
                      htmlFor="apply-review-consent-checkbox"
                      className="flex items-start gap-3 p-3.5 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark cursor-pointer select-none"
                    >
                      <input
                        id="apply-review-consent-checkbox"
                        type="checkbox"
                        checked={isConsentChecked}
                        disabled={isSubmitting}
                        onChange={(e) => setIsConsentChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded-cell-input border-border-light dark:border-border-dark text-brand-primary-light focus:ring-brand-primary-light cursor-pointer"
                      />
                      <span className="text-xs sm:text-sm font-medium text-text-primary-light dark:text-text-primary-dark leading-snug">
                        Saya memahami bahwa{' '}
                        <strong className="font-mono tabular-numbers">
                          {formatNumberId(previewData.baris_dibuang, 0)} baris
                        </strong>{' '}
                        yang ditolak akan dibuang dari{' '}
                        <strong className="font-mono">
                          Versi Bersih v{targetNewVersion}
                        </strong>
                        , tindakan ini tidak dapat dibatalkan, dan aplikasi ini
                        belum memiliki fitur untuk memulihkan versi data bersih
                        sebelumnya tanpa menjalankan pembersihan ulang dari data
                        mentah.
                      </span>
                    </label>
                  </div>

                  {/* Kotak Error Eksekusi di Dalam Modal (Penyesuaian Wajib butir g) */}
                  {executionError && (
                    <div
                      role="alert"
                      className="p-4 rounded-card bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border border-anomaly-danger-text-light dark:border-anomaly-danger-text-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex items-start gap-3 text-xs sm:text-sm"
                    >
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold">
                          Gagal Menerapkan Hasil Review
                        </div>
                        <p>{executionError}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Tombol Aksi Modal */}
        <div className="px-6 py-4 bg-header-light/60 dark:bg-header-dark/60 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
          {step === 1 ? (
            <>
              <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Data pratinjau diambil segar dari server saat dialog dibuka.
              </span>
              <div className="flex items-center gap-3">
                <button
                  ref={step1CancelBtnRef}
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-control"
                >
                  Batal
                </button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    isLoadingPreview ||
                    Boolean(previewError) ||
                    !previewData ||
                    previewData.baris_dibuang <= 0
                  }
                  icon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => {
                    setPreCheckDriftWarning(null);
                    setExecutionError(null);
                    setIsConsentChecked(false);
                    setStep(2);
                  }}
                >
                  Lanjut ke Konfirmasi Akhir
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => {
                  setExecutionError(null);
                  setStep(1);
                }}
              >
                Kembali ke Langkah 1
              </Button>

              <div className="flex items-center gap-3">
                {/* Fokus awal pada Langkah 2 ditempatkan pada tombol Batal ini (Butir b) */}
                <button
                  ref={step2CancelBtnRef}
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-control disabled:opacity-50"
                >
                  Batal
                </button>

                <Button
                  type="button"
                  variant="danger"
                  disabled={
                    !isConsentChecked || isSubmitting || !previewData
                  }
                  onClick={() => void handleFinalConfirmExecution()}
                  icon={
                    isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )
                  }
                  className="font-bold"
                >
                  {isSubmitting
                    ? submitPhaseLabel
                    : `Ya, Buang ${formatNumberId(
                        previewData?.baris_dibuang ?? 0,
                        0
                      )} Baris & Buat Versi Bersih v${targetNewVersion}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
