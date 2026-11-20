import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Edit3, X } from 'lucide-react';
import { AnomalyItem } from '@/types/dataset';
import { formatCellValueId } from '@/utils/formatters';

interface InlineCellEditorPopoverProps {
  /** Objek anomali asli dari backend (selalu memakai row_index & kolom dari anomali ini) */
  anomaly: AnomalyItem;
  /** Nilai sel saat ini (hanya ditampilkan jika baris telah terverifikasi) */
  verifiedCurrentValue?: unknown;
  /** Apakah nilai sel saat ini telah terverifikasi dari pemetaan baris */
  isValueVerified: boolean;
  /** Apakah kolom ini bertipe numerik (untuk validasi tipe angka di sisi klien) */
  isNumericColumn: boolean;
  /** Apakah permintaan PATCH sedang berlangsung */
  isSaving: boolean;
  /** Callback saat pengguna menyimpan perubahan */
  onSave: (params: {
    rowIndex: number;
    kolom: string;
    nilai: string | number | null;
    alasan: string;
  }) => void;
  /** Callback saat pengguna membatalkan (Esc atau klik Batal) */
  onCancel: () => void;
}

const MIN_ALASAN_LENGTH = 5;
const MAX_ALASAN_LENGTH = 500;

/**
 * Popover Inline Cell Editor (F-15, F-19)
 * Sesuai Aturan Konten Fase 3:
 * - Selalu menggunakan anomaly.row_index dan anomaly.kolom dari backend.
 * - Menampilkan nomor baris di file asli (`baris_di_file_asli`), nama kolom, alasan anomali,
 *   dan nilai saat ini (hanya jika terverifikasi).
 * - Validasi tipe numerik di sisi klien (kotak error inline, tanpa toast ganda).
 * - Alasan perubahan wajib minimal 5 karakter dengan penghitung karakter.
 * - Pintasan keyboard: Enter untuk simpan, Esc untuk batal.
 */
export const InlineCellEditorPopover: React.FC<InlineCellEditorPopoverProps> = ({
  anomaly,
  verifiedCurrentValue,
  isValueVerified,
  isNumericColumn,
  isSaving,
  onSave,
  onCancel,
}) => {
  const initialInput =
    isValueVerified &&
    verifiedCurrentValue !== null &&
    verifiedCurrentValue !== undefined
      ? String(verifiedCurrentValue)
      : '';

  const [inputValue, setInputValue] = useState<string>(initialInput);
  const [alasan, setAlasan] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const valueInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    valueInputRef.current?.focus();
    valueInputRef.current?.select();
  }, []);

  const trimmedAlasan = alasan.trim();
  const alasanCount = trimmedAlasan.length;
  const isAlasanValid =
    alasanCount >= MIN_ALASAN_LENGTH && alasanCount <= MAX_ALASAN_LENGTH;

  const validateAndSubmit = () => {
    setValidationError(null);

    if (!isAlasanValid) {
      setValidationError(
        `Alasan perubahan wajib diisi minimal ${MIN_ALASAN_LENGTH} karakter (saat ini ${alasanCount} karakter).`
      );
      return;
    }

    const trimmedVal = inputValue.trim();
    let finalValue: string | number | null = trimmedVal === '' ? null : trimmedVal;

    // Validasi tipe numerik di sisi klien sesuai edits.py (_convert)
    if (isNumericColumn && trimmedVal !== '') {
      // Dukung input desimal dengan titik atau koma jika pengguna mengetik angka standar
      const normalizedNumberString =
        trimmedVal.includes(',') && !trimmedVal.includes('.')
          ? trimmedVal.replace(',', '.')
          : trimmedVal;
      const parsedNum = Number(normalizedNumberString);

      if (!Number.isFinite(parsedNum)) {
        setValidationError(
          `Kolom "${anomaly.kolom}" bertipe angka. Nilai "${trimmedVal}" bukan angka yang valid.`
        );
        return;
      }
      finalValue = parsedNum;
    }

    // Cek apakah nilai sama persis dengan nilai terverifikasi saat ini
    if (isValueVerified) {
      const currentEmpty =
        verifiedCurrentValue === null ||
        verifiedCurrentValue === undefined ||
        verifiedCurrentValue === '';
      if (currentEmpty && finalValue === null) {
        setValidationError(
          'Nilai baru masih kosong (sama dengan data saat ini). Masukkan nilai perbaikan.'
        );
        return;
      }
      if (
        !currentEmpty &&
        finalValue !== null &&
        String(finalValue) === String(verifiedCurrentValue)
      ) {
        setValidationError(
          'Nilai baru sama dengan nilai saat ini. Ubah nilai sebelum menyimpan.'
        );
        return;
      }
    }

    onSave({
      rowIndex: anomaly.row_index,
      kolom: anomaly.kolom,
      nilai: finalValue,
      alasan: trimmedAlasan,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (!isSaving) {
        onCancel();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!isSaving) {
        validateAndSubmit();
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={`Edit sel kolom ${anomaly.kolom} pada baris file ${anomaly.baris_di_file_asli}`}
      className="w-80 p-4 rounded-popover bg-surface-light dark:bg-surface-dark border-2 border-brand-primary-light dark:border-brand-primary-dark shadow-xl space-y-3 text-left font-sans z-40"
    >
      {/* Header Metadata Sel Target */}
      <div className="flex items-start justify-between gap-2 border-b border-border-light dark:border-border-dark pb-2.5">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-primary-light dark:text-brand-primary-dark">
            <Edit3 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Baris File #{anomaly.baris_di_file_asli} • Kolom{' '}
              <span className="font-mono">{anomaly.kolom}</span>
            </span>
          </div>
          <p className="text-xs text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark font-mono break-words">
            {anomaly.alasan}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Tutup editor sel"
          className="p-1 rounded-button text-text-muted-light dark:text-text-muted-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Informasi Nilai Saat Ini (Hanya jika terverifikasi) */}
      {isValueVerified && (
        <div className="px-2.5 py-1.5 rounded-button bg-header-light dark:bg-header-dark text-xs flex items-center justify-between gap-2">
          <span className="text-text-secondary-light dark:text-text-secondary-dark">
            Nilai Saat Ini:
          </span>
          <span className="font-mono font-bold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
            {formatCellValueId(verifiedCurrentValue)}
          </span>
        </div>
      )}

      {/* Input Nilai Perbaikan */}
      <div className="space-y-1">
        <label
          htmlFor={`cell-edit-val-${anomaly.id}`}
          className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark"
        >
          Nilai Baru {isNumericColumn ? '(Numerik)' : '(Teks / Nilai)'}:
        </label>
        <input
          ref={valueInputRef}
          id={`cell-edit-val-${anomaly.id}`}
          type="text"
          inputMode={isNumericColumn ? 'decimal' : 'text'}
          value={inputValue}
          disabled={isSaving}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (validationError) setValidationError(null);
          }}
          placeholder={
            isNumericColumn
              ? 'Masukkan angka perbaikan...'
              : 'Masukkan nilai perbaikan...'
          }
          className="w-full px-3 py-2 text-sm font-mono tabular-numbers rounded-cell-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
        />
      </div>

      {/* Input Alasan Perubahan Wajib (Min. 5 Karakter) + Penghitung Karakter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`cell-edit-reason-${anomaly.id}`}
            className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark"
          >
            Alasan Perubahan (Wajib min. 5 karakter):
          </label>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold tabular-numbers ${
              isAlasanValid
                ? 'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark'
                : 'bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark'
            }`}
          >
            Karakter: {alasanCount}/{MIN_ALASAN_LENGTH} min.
          </span>
        </div>
        <input
          id={`cell-edit-reason-${anomaly.id}`}
          type="text"
          maxLength={MAX_ALASAN_LENGTH}
          value={alasan}
          disabled={isSaving}
          onChange={(e) => {
            setAlasan(e.target.value);
            if (validationError) setValidationError(null);
          }}
          placeholder="Mis. Koreksi sesuai dokumen rekapitulasi resmi"
          className="w-full px-3 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
        />
      </div>

      {/* Kotak Validasi Inline (Hanya untuk validasi form, tidak memicu toast) */}
      {validationError && (
        <div
          role="alert"
          className="p-2.5 rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark text-xs font-medium flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Tombol Aksi Batal (Esc) & Simpan (Enter) */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-3 py-2 text-xs font-semibold rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-header-light dark:hover:bg-header-dark transition-colors min-h-control"
        >
          Batal (Esc)
        </button>
        <button
          type="button"
          onClick={validateAndSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-button bg-brand-primary-light text-white dark:bg-brand-cyan dark:text-canvas-dark hover:opacity-95 transition-opacity disabled:opacity-50 min-h-control"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Menyimpan...' : 'Simpan (Enter)'}</span>
        </button>
      </div>
    </div>
  );
};
