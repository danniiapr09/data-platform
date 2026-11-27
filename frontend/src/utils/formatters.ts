/**
 * Utilitas pemformatan angka, tanggal, ukuran berkas, tipe data, dan kategori
 * sesuai standar Bahasa Indonesia (id-ID) dan design-system.md.
 */

const numberFormatterInt = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const numberFormatterCache = new Map<number, Intl.NumberFormat>();
function getDecimalFormatter(maxDecimals: number): Intl.NumberFormat {
  let formatter = numberFormatterCache.get(maxDecimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    });
    numberFormatterCache.set(maxDecimals, formatter);
  }
  return formatter;
}

const dateTimeFormatterId = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
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
  return getDecimalFormatter(maxDecimals).format(value);
}

/** Format persentase standar Indonesia (contoh: 96,4%) */
export function formatPercentId(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  const formatted = getDecimalFormatter(2).format(value);
  return `${formatted}%`;
}

/** Format rasio kelipatan agar nilai kecil non-nol tidak dibulatkan menjadi 0x */
export function formatRatioMultiplierId(
  value: number | null | undefined
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  if (value !== 0 && Math.abs(value) < 0.01) {
    return `${getDecimalFormatter(4).format(value)}x`;
  }
  return `${getDecimalFormatter(2).format(value)}x`;
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
    // Pastikan string ISO tanpa zona waktu diperlakukan konsisten (dukung Z, +HH:MM, -HH:MM)
    const hasTz = /([Zz]|[+-]\d{2}:?\d{2})$/.test(isoString);
    const normalizedIso = hasTz ? isoString : `${isoString}Z`;
    const date = new Date(normalizedIso);
    if (Number.isNaN(date.getTime())) return '-';

    return dateTimeFormatterId.format(date);
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

/** Deteksi apakah nama kolom merepresentasikan tahun kalender */
export function isYearColumnName(colName?: string | null): boolean {
  if (!colName) return false;
  const lower = colName.trim().toLowerCase();
  return lower === 'tahun' || lower === 'year' || lower.startsWith('tahun_') || lower.endsWith('_tahun') || lower.startsWith('year_') || lower.endsWith('_year');
}

/** Format nilai sel tabel pratinjau agar angka terformat id-ID, tahun 4 digit tanpa titik ribuan, dan nilai kosong tampil '-' */
export function formatCellValueId(value: unknown, colName?: string | null): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'number') {
    if (
      isYearColumnName(colName) &&
      Number.isInteger(value) &&
      value >= 1900 &&
      value <= 2100
    ) {
      return String(value);
    }
    return formatNumberId(value, 4);
  }
  if (typeof value === 'boolean') {
    return value ? 'Ya' : 'Tidak';
  }
  return String(value);
}
