/**
 * Utilitas pemformatan angka, tanggal, ukuran berkas, tipe data, dan kategori
 * sesuai standar Bahasa Indonesia (id-ID) dan design-system.md.
 */

const numberFormatterInt = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

/** Format angka dengan titik ribuan dan koma desimal (standar id-ID) */
export function formatNumberId(
  value: number | null | undefined,
  maxDecimals = 2
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (Number.isInteger(value) || maxDecimals === 0) {
    return numberFormatterInt.format(value);
  }
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

/** Format persentase standar Indonesia (contoh: 96,4%) */
export function formatPercentId(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

/** Format ukuran berkas dalam B, KB, atau MB */
export function formatFileSizeId(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes) || bytes < 0) {
    return '-';
  }
  if (bytes < 1024) {
    return `${formatNumberId(bytes, 0)} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${formatNumberId(kb, 1)} KB`;
  }
  const mb = kb / 1024;
  return `${formatNumberId(mb, 2)} MB`;
}

/** Format tanggal & waktu ISO ke format ringkas Bahasa Indonesia */
export function formatDateTimeId(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    // Pastikan string ISO tanpa zona waktu diperlakukan konsisten
    const normalizedIso =
      isoString.endsWith('Z') || isoString.includes('+')
        ? isoString
        : `${isoString}Z`;
    const date = new Date(normalizedIso);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '-';
  }
}

/**
 * Ekstrak badge format berkas (CSV / XLSX / XLS) dari ekstensi nama dataset hanya jika ada.
 * Jika nama dataset tidak berekstensi, kembalikan null (sembunyikan badge, jangan menebak).
 * // TODO(B-08): Format berkas sebaiknya dikirim eksplisit sebagai field tersendiri dari backend.
 */
export function extractFileExtensionBadge(
  namaDataset: string | null | undefined,
  explicitFormat?: string | null
): 'CSV' | 'XLSX' | 'XLS' | null {
  if (explicitFormat) {
    const cleanFmt = explicitFormat.trim().replace(/^\./, '').toUpperCase();
    if (cleanFmt === 'CSV' || cleanFmt === 'XLSX' || cleanFmt === 'XLS') {
      return cleanFmt;
    }
  }
  if (!namaDataset) return null;
  const trimmed = namaDataset.trim().toLowerCase();
  if (trimmed.endsWith('.csv')) return 'CSV';
  if (trimmed.endsWith('.xlsx')) return 'XLSX';
  if (trimmed.endsWith('.xls')) return 'XLS';
  return null;
}

/**
 * Normalisasi label Jenis / Kategori Dataset ke huruf kapital di awal kata (Title Case)
 * agar "umum" dan "Umum" tidak menjadi dua entri terpisah di tampilan maupun filter.
 */
export function normalizeJenisLabel(jenis: string | null | undefined): string {
  if (!jenis || !jenis.trim()) return 'Umum';
  return jenis
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalisasi tipe data pandas/backend ke 4 kategori badge standar design-system.md:
 * 'integer' | 'decimal' | 'date' | 'text'
 */
export function normalizeDataTypeLabel(
  rawType: string | null | undefined
): 'integer' | 'decimal' | 'date' | 'text' {
  if (!rawType) return 'text';
  const t = rawType.toLowerCase();
  if (t.includes('int') || t === 'integer') return 'integer';
  if (t.includes('float') || t.includes('double') || t === 'decimal' || t === 'numerik') {
    return 'decimal';
  }
  if (t.includes('date') || t.includes('time')) return 'date';
  return 'text';
}

/** Format nilai sel tabel pratinjau agar angka terformat id-ID dan nilai kosong tampil '-' */
export function formatCellValueId(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'number') {
    return formatNumberId(value, 4);
  }
  if (typeof value === 'boolean') {
    return value ? 'Ya' : 'Tidak';
  }
  return String(value);
}
