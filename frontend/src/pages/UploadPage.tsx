import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Columns,
  FileSpreadsheet,
  Info,
  Lock,
  RefreshCw,
  Table,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { DataTypeBadge, FormatFileBadge } from '@/components/common/StatusBadge';
import { showToast } from '@/components/common/Toast';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { uploadDataset } from '@/services/datasetService';
import { UploadDatasetResponse } from '@/types/dataset';
import {
  formatCellValueId,
  formatFileSizeId,
  formatNumberId,
} from '@/utils/formatters';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_NAMA_LENGTH = 150; // Sesuai Dataset.nama String(150) di backend/app/models.py
const MAX_JENIS_LENGTH = 50; // Sesuai Dataset.jenis String(50) di backend/app/models.py

const STANDARD_CATEGORIES = [
  'Pendidikan',
  'Kesehatan',
  'Keuangan',
  'Kepegawaian',
  'Kependudukan',
  'Infrastruktur',
  'Logistik',
  'Umum',
] as const;

const CUSTOM_CATEGORY_VALUE = '__LAINNYA__';

export const UploadPage: React.FC = () => {
  useDocumentTitle('Unggah Dataset Baru');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [namaDataset, setNamaDataset] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Umum');
  const [customCategory, setCustomCategory] = useState<string>('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [uploadResult, setUploadResult] =
    useState<UploadDatasetResponse | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const validateAndSetFile = (file: File) => {
    setValidationError(null);

    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );

    if (!hasValidExt) {
      setSelectedFile(null);
      setValidationError(
        'Format berkas tidak didukung. Gunakan berkas CSV (.csv) atau Microsoft Excel (.xlsx, .xls).'
      );
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setValidationError(
        'Berkas yang dipilih kosong (0 byte). Silakan pilih berkas yang berisi data.'
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setValidationError(
        `Ukuran berkas (${formatFileSizeId(
          file.size
        )}) melebihi batas maksimal 10 MB. Silakan pilih berkas yang lebih kecil.`
      );
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedFile) {
      setValidationError(
        'Silakan pilih berkas CSV atau Excel terlebih dahulu sebelum mengunggah.'
      );
      return;
    }

    let finalJenis = 'umum';
    if (selectedCategory === CUSTOM_CATEGORY_VALUE) {
      const trimmedCustom = customCategory.trim();
      if (!trimmedCustom) {
        setValidationError(
          'Kategori manual wajib diisi jika memilih opsi "Lainnya (Ketik Manual)".'
        );
        return;
      }
      if (trimmedCustom.length > MAX_JENIS_LENGTH) {
        setValidationError(
          `Panjang kategori jenis dataset maksimal ${MAX_JENIS_LENGTH} karakter.`
        );
        return;
      }
      finalJenis = trimmedCustom;
    } else if (selectedCategory === 'Umum') {
      // Sesuai aturan: nilai "Umum" dikirim sebagai "umum" (default backend)
      finalJenis = 'umum';
    } else {
      finalJenis = selectedCategory;
    }

    if (namaDataset.trim().length > MAX_NAMA_LENGTH) {
      setValidationError(
        `Nama dataset maksimal ${MAX_NAMA_LENGTH} karakter.`
      );
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const currentFileSize = selectedFile.size;
      const currentFileName = selectedFile.name;

      const result = await uploadDataset({
        file: selectedFile,
        nama: namaDataset.trim() || undefined,
        jenis: finalJenis,
        onProgress: (pct) => setUploadProgress(pct),
      });

      setUploadResult(result);
      setUploadedFileSize(currentFileSize);
      setUploadedFileName(currentFileName);

      // Simpan profil kolom data mentah (v0) hanya di memori cache React Query (tanpa sessionStorage/localStorage)
      queryClient.setQueryData(
        ['dataset-upload-profile', String(result.dataset_id)],
        result.kolom
      );

      // Segarkan cache katalog dan ringkasan beranda di React Query
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['datasets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ]);

      showToast(
        `Dataset "${result.nama}" berhasil diunggah (${formatNumberId(
          result.jumlah_baris,
          0
        )} baris).`,
        'success'
      );
    } catch {
      // Error jaringan/server sudah ditampilkan sekali lewat Toast dari apiClient
    } finally {
      setIsUploading(false);
    }
  };

  const previewColumns =
    uploadResult && uploadResult.preview.length > 0
      ? Object.keys(uploadResult.preview[0])
      : uploadResult?.kolom.map((k) => k.kolom) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
            Unggah & Profiling Awal Dataset
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Tambahkan berkas data CSV atau Excel untuk pemeriksaan skema otomatis, deteksi tipe data, dan pratinjau mentah sebelum masuk tahap kurasi & pembersihan data.
          </p>
        </div>
      </div>

      {/* Form Unggah & Metadata (F-06 & F-07) */}
      <form
        onSubmit={handleUploadSubmit}
        className="p-6 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Zona Drag & Drop (7 Kolom) */}
          <div className="lg:col-span-7 space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Area unggah berkas CSV atau Excel"
              className={`p-8 rounded-card border-2 border-dashed transition-colors cursor-pointer text-center flex flex-col items-center justify-center min-h-[220px] ${
                isDragging
                  ? 'border-brand-primary-light dark:border-brand-primary-dark bg-brand-primary-light/5 dark:bg-brand-primary-dark/10'
                  : 'border-border-light dark:border-border-dark bg-canvas-light/60 dark:bg-canvas-dark/60 hover:border-brand-primary-light dark:hover:border-brand-primary-dark'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark max-w-md">
                Seret & lepas berkas CSV atau Excel (.csv, .xlsx, .xls) di sini, atau klik untuk memilih
              </p>
              <p className="text-xs text-text-muted-light dark:text-text-secondary-dark mt-1.5">
                Ukuran maksimal 10 MB • Format yang didukung: UTF-8 CSV, Microsoft Excel (.xlsx, .xls)
              </p>
            </div>

            {/* Kartu Info Berkas Terpilih */}
            {selectedFile && (
              <div className="p-3.5 rounded-card bg-header-light/50 dark:bg-header-dark/50 border border-border-light dark:border-border-dark flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                        {selectedFile.name}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-mono rounded-button bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0 tabular-numbers">
                        {formatFileSizeId(selectedFile.size)}
                      </span>
                    </div>
                    <p className="text-xs text-anomaly-success-text-light dark:text-anomaly-success-text-dark flex items-center gap-1 mt-0.5 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Siap diproses oleh sistem kurasi</span>
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Ganti Berkas
                </Button>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Formulir Metadata (5 Kolom) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Input Nama Dataset (Opsional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="input-nama-dataset"
                  className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
                >
                  Nama Dataset (Opsional)
                </label>
                <input
                  id="input-nama-dataset"
                  type="text"
                  maxLength={MAX_NAMA_LENGTH}
                  value={namaDataset}
                  onChange={(e) => setNamaDataset(e.target.value)}
                  placeholder="Otomatis menggunakan nama berkas jika kosong"
                  className="w-full px-3.5 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
                />
                <p className="text-xs text-text-muted-light dark:text-text-secondary-dark">
                  Akan digunakan sebagai label identitas resmi pada katalog dan laporan operasional (maks. {MAX_NAMA_LENGTH} karakter).
                </p>
              </div>

              {/* Dropdown Jenis / Kategori Dataset */}
              <div className="space-y-1.5">
                <label
                  htmlFor="select-jenis-dataset"
                  className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
                >
                  Jenis / Kategori Dataset
                </label>
                <select
                  id="select-jenis-dataset"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-3.5 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
                >
                  {STANDARD_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value={CUSTOM_CATEGORY_VALUE}>
                    Lainnya (Ketik Manual)
                  </option>
                </select>
              </div>

              {/* Input Teks Kategori Manual jika memilih "Lainnya (Ketik Manual)" */}
              {selectedCategory === CUSTOM_CATEGORY_VALUE && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-custom-jenis"
                    className="block text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark"
                  >
                    Kategori Manual (Wajib Diisi)
                  </label>
                  <input
                    id="input-custom-jenis"
                    type="text"
                    required
                    maxLength={MAX_JENIS_LENGTH}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    aria-describedby="custom-jenis-help"
                    aria-invalid={Boolean(validationError && !customCategory.trim())}
                    placeholder="Masukkan nama kategori dataset..."
                    className="w-full px-3.5 py-2 text-sm rounded-input border border-border-light dark:border-border-dark bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary-light dark:focus:ring-brand-primary-dark min-h-control"
                  />
                  <p id="custom-jenis-help" className="text-xs text-text-secondary-light dark:text-text-secondary-dark tabular-numbers">
                    Maksimal {MAX_JENIS_LENGTH} karakter ({customCategory.trim().length}/{MAX_JENIS_LENGTH}).
                  </p>
                </div>
              )}
            </div>

            {/* Progress Bar Unggah */}
            {isUploading && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                  <span>Mengunggah & menganalisis skema...</span>
                  <span className="tabular-numbers">{uploadProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Progres unggah dataset"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full h-2 rounded-full bg-header-light dark:bg-header-dark overflow-hidden"
                >
                  <div
                    className="h-full bg-brand-primary-light dark:bg-brand-primary-dark transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pesan Error Validasi Sisi Klien (Error server ditangani oleh Toast agar tidak ganda) */}
            {validationError && (
              <div
                id="upload-validation-error"
                role="alert"
                className="p-3.5 rounded-button bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark border border-anomaly-danger-text-light/30 dark:border-anomaly-danger-text-dark/40 text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark text-sm font-medium flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Tombol Submit Unggah */}
            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || isUploading}
                icon={
                  <RefreshCw
                    className={`w-4 h-4 ${isUploading ? 'animate-spin' : ''}`}
                  />
                }
                className="w-full sm:w-auto"
              >
                {isUploading ? 'Memproses Berkas...' : 'Unggah & Analisis Skema'}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Panel Umpan Balik Hasil Unggah (F-08) */}
      {uploadResult && (
        <div className="space-y-6">
          {/* Barisan Chip Ringkasan Hasil Unggah */}
          <div className="p-4 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-button bg-header-light dark:bg-header-dark text-xs font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                <FileSpreadsheet className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
                <span>{uploadResult.nama}</span>
                <FormatFileBadge
                  namaDataset={uploadedFileName || uploadResult.nama}
                />
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-header-light dark:bg-header-dark text-xs font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                <Table className="w-3.5 h-3.5 text-brand-cyan" />
                <span>
                  {formatNumberId(uploadResult.jumlah_baris, 0)} Baris
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-button bg-header-light dark:bg-header-dark text-xs font-mono font-semibold tabular-numbers text-text-primary-light dark:text-text-primary-dark">
                <Columns className="w-3.5 h-3.5 text-brand-primary-light dark:text-brand-primary-dark" />
                <span>
                  {formatNumberId(uploadResult.jumlah_kolom, 0)} Kolom Terdeteksi
                </span>
              </span>

              {uploadedFileSize !== null && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-button bg-header-light dark:bg-header-dark text-xs font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                  {formatFileSizeId(uploadedFileSize)}
                </span>
              )}
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Validasi Skema Berhasil</span>
            </span>
          </div>

          {/* 2 Panel Berdampingan: Daftar Kolom & Pratinjau 10 Baris Mentah */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Panel Kiri: Daftar Kolom & Deteksi Tipe (5 Kolom) */}
            <div className="lg:col-span-5 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col overflow-hidden">
              <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Columns className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
                  <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                    Daftar Kolom & Deteksi Tipe ({formatNumberId(uploadResult.kolom.length, 0)} Kolom)
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[460px] overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0">
                      <th scope="col" className="py-3 px-4">Nama Kolom</th>
                      <th scope="col" className="py-3 px-3">Tipe</th>
                      <th scope="col" className="py-3 px-3">Sel Kosong</th>
                      <th scope="col" className="py-3 px-3">Unik</th>
                      <th scope="col" className="py-3 px-4">Sampel Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                    {uploadResult.kolom.map((col) => {
                      const emptyPercent =
                        uploadResult.jumlah_baris > 0
                          ? (col.kosong / uploadResult.jumlah_baris) * 100
                          : 0;

                      return (
                        <tr
                          key={col.kolom}
                          className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50"
                        >
                          <td className="py-3 px-4 font-mono font-semibold text-text-primary-light dark:text-text-primary-dark">
                            {col.kolom}
                          </td>
                          <td className="py-3 px-3">
                            <DataTypeBadge rawType={col.tipe} />
                          </td>
                          <td className="py-3 px-3 font-mono tabular-numbers">
                            <span
                              className={
                                col.kosong > 0
                                  ? 'font-bold text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark'
                                  : 'text-text-secondary-light dark:text-text-secondary-dark'
                              }
                            >
                              {formatNumberId(col.kosong, 0)} (
                              {formatNumberId(emptyPercent, 2)}%)
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono tabular-numbers text-text-secondary-light dark:text-text-secondary-dark">
                            {formatNumberId(col.unik, 0)}
                          </td>
                          <td
                            className="py-3 px-4 font-mono text-text-secondary-light dark:text-text-secondary-dark truncate max-w-[160px]"
                            title={
                              col.contoh && col.contoh.length > 0
                                ? col.contoh.slice(0, 3).join(', ')
                                : '-'
                            }
                          >
                            {col.contoh && col.contoh.length > 0
                              ? col.contoh.slice(0, 3).join(', ')
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Kanan: Pratinjau 10 Baris Data Mentah Tanpa Pewarnaan Anomali (7 Kolom) */}
            <div className="lg:col-span-7 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex flex-col justify-between overflow-hidden">
              <div>
                <div className="p-4 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark" />
                    <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                      Pratinjau Data Mentah ({formatNumberId(uploadResult.preview.length, 0)} dari{' '}
                      {formatNumberId(uploadResult.jumlah_baris, 0)} Baris)
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-header-light dark:bg-header-dark text-text-muted-light dark:text-text-secondary-dark">
                    <Lock className="w-3 h-3" />
                    <span>Pratinjau Baca-Saja (v0)</span>
                  </span>
                </div>

                {/* Tabel Pratinjau Tanpa Pewarnaan Anomali */}
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-header-light dark:bg-header-dark border-b border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark sticky top-0">
                        <th className="py-3 px-3 w-12 text-center">#</th>
                        {previewColumns.map((colName) => (
                          <th key={colName} className="py-3 px-4 whitespace-nowrap">
                            {colName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm font-mono tabular-numbers">
                      {uploadResult.preview.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-canvas-light dark:hover:bg-canvas-dark/50"
                        >
                          <td className="py-2.5 px-3 text-center text-xs text-text-muted-light dark:text-text-secondary-dark">
                            {idx + 1}
                          </td>
                          {previewColumns.map((colName) => (
                            <td
                              key={colName}
                              className="py-2.5 px-4 text-text-primary-light dark:text-text-primary-dark whitespace-nowrap rounded-cell"
                            >
                              {formatCellValueId(row[colName])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Panel Pratinjau & Tombol Lanjut ke Workspace */}
              <div className="p-4 bg-header-light/40 dark:bg-header-dark/40 border-t border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                  <Info className="w-4 h-4 text-brand-primary-light dark:text-brand-primary-dark flex-shrink-0" />
                  <span>
                    Data mentah (v0) tersimpan utuh. Pembersihan dan deteksi anomali dilakukan di dalam Workspace Dataset.
                  </span>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  icon={<ArrowRight className="w-4 h-4" />}
                  onClick={() =>
                    navigate(
                      `/workspace/${uploadResult.dataset_id}/data-struktur`
                    )
                  }
                >
                  Lanjut ke Workspace Dataset
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
