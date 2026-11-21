import { AnomalyItem, DataEditHistoryItem } from '@/types/dataset';

/**
 * Fungsi Murni Pemetaan Posisi Baris ke `row_index` Asli & Verifikasi Silang Anomali
 * (Keselamatan Pengenal Baris Fase 3 - sampai B-04 & B-05 aktif di backend).
 *
 * LATAR BELAKANG KODE BACKEND (`backend/app/cleaning/engine.py` & `config/cleaning_rules.yaml`):
 * 1. Pada `engine.py` baris 85-93:
 *    - Jika `rules["duplicates"]["action"] == "drop"` (ini adalah nilai default di `config/cleaning_rules.yaml`),
 *      baris duplikat langsung dibuang (`df = df[~dup_mask]`) dan TIDAK dicatat ke dalam tabel `anomalies`
 *      (`anomalies.append` untuk `[duplikat]` hanya berada di cabang `else:` ketika `action == "flag"`).
 *    - Oleh karena itu, ketika ada duplikat yang dibuang (`duplikat_dihapus > 0`) atau review yang pernah
 *      diterapkan (`jumlah_review_diterapkan > 0`), kita TIDAK BISA mendapatkan daftar `row_index` yang
 *      dibuang dari `GET /anomalies/items`.
 * 2. Selain itu, `GET /datasets/{id}/clean-preview` (`cleaning.py` baris 88-96) hanya mengembalikan
 *    `"preview": [r.row_json for r in rows]` tanpa menyertakan kolom `r.row_index`.
 *
 * URUTAN METODE PEMETAAN PALING SEDERHANA & AMAN:
 * - Jalur 0 (B-04 Aktif): Jika respons `clean-preview` menyertakan `row_indices` eksplisit, gunakan langsung.
 * - Jalur 1 (Tanpa Baris Dibuang): Jika `baris_awal === baris_akhir` (atau `baris_mentah === baris_bersih`),
 *   `duplikat_dihapus === 0`, dan `jumlah_review_diterapkan === 0`, maka tidak ada baris yang hilang:
 *   posisi ke-`i` di `clean-preview` = `row_index = i` (`baris_di_file_asli = i + 2`).
 * - Jalur 2 (Alignment Sekuensial `RawData -> CleanData` saat ada baris dibuang dan `baris_mentah <= 200`):
 *   Karena `clean()` dan `apply_review` tidak pernah mengacak urutan baris (`order_by(row_index)`),
 *   setiap baris bersih ke-`i` dicocokkan maju (monotonik) terhadap baris `RawData` (`GET /datasets/{id}/preview?limit=200`)
 *   dengan memperhitungkan normalisasi `clean()` (lowercase nama kolom, trim spasi, konversi angka,
 *   nilai `null` akibat gagal parse `[format]`, dan nilai baru dari `DataEdit` pada `row_index` terkait).
 *   Jika untuk satu baris bersih terdapat lebih dari satu kandidat `RawData` yang identik (misal baris duplikat),
 *   sesuai `df.duplicated(keep="first")` di `engine.py`, kandidat pertama adalah baris yang dipertahankan.
 *
 * SYARAT VALIDASI KETAT (ZERO-RISK CROSS-CHECK - FASE 3 & FASE 4):
 * Pemetaan HANYA dinyatakan VALID (`isValid: true`) jika SELURUH syarat berikut terpenuhi:
 * 1. Jumlah baris `clean-preview` yang diterima sama dengan `min(barisBersih, 200)` (di mana `barisBersih`
 *    diambil dari `dataset.baris_bersih` terkini).
 * 2. Setiap baris `clean-preview` berhasil mendapatkan `row_index` yang unik dan naik monotonik (`strictly increasing`).
 * 3. SETIAP anomali yang berada dalam rentang `row_index` yang dimuat LULUS UJI SILANG NILAI SEL:
 *    - PENELONGGARAN KHUSUS FASE 4 (Butir d): Jika anomali tidak ditemukan di `rowByRowIndex`, pelonggaran
 *      HANYA diberikan jika `anomaly.status === 'ditolak'` DAN `anomaly.row_index` terbukti SUDAH DIBUANG
 *      (baik terdaftar di `provenAlreadyDroppedRowIndices` dari evaluasi `apply-review?preview=true` menurut
 *      butir c, maupun terbukti dari konsistensi jumlah baris saat `jumlahReviewDiterapkan > 0`).
 *      Anomali berstatus LAIN (`pending`, `diterima`, `diperbaiki`) yang hilang dari data bersih TETAP
 *      menggagalkan pemetaan (memicu Mode Daftar Anomali), kecuali jika pada `row_index` yang sama terdapat
 *      anomali berstatus `ditolak` yang terbukti sudah membuang seluruh baris tersebut.
 *    - Jika `anomali.status === 'diperbaiki'`, nilai sel saat ini wajib cocok dengan `nilai_baru` terakhir di `DataEdit`
 *      pada `(row_index, kolom)` tersebut (bila riwayat edit tersedia).
 *    - Jika `anomali.status !== 'diperbaiki'`:
 *      * Jenis `kosong` (`[kosong]`): nilai sel di `clean-preview` wajib kosong (`null`, `undefined`, atau `""`).
 *      * Jenis `format` (`[format] nilai 'X' bukan angka`): karena `pd.to_numeric(..., errors="coerce")` mengubah
 *        nilai gagal parse menjadi `NaN` (`null` di JSON), nilai sel di `clean-preview` wajib `null` DAN
 *        (bila `RawData` tersedia) nilai mentah pada `RawData[row_index][kolom]` wajib cocok dengan `'X'`.
 *      * Jenis `outlier` (`[outlier] nilai X ...`): nilai numerik sel di `clean-preview` wajib cocok dengan angka `X`
 *        yang tertulis di `alasan` anomali (dalam toleransi pembulatan floating-point `1e-6`).
 *
 * Jika SATU SAJA syarat di atas gagal atau ambigu, fungsi mengembalikan `isValid: false` beserta alasan
 * Bahasa Indonesia yang jelas, sehingga UI beralih ke "Mode Daftar Anomali" dan TIDAK mewarnai grid.
 */

export interface VerifiedCleanRow {
  /** Indeks posisi di array clean-preview (0..N-1) */
  previewIndex: number;
  /** row_index database (0-based terhadap RawData) yang sudah terverifikasi */
  rowIndex: number;
  /** Nomor baris di file Excel/CSV asli (row_index + 2; baris 1 adalah header) */
  barisDiFileAsli: number;
  /** Data sel baris bersih */
  data: Record<string, unknown>;
  /** Peta anomali per nama kolom pada baris ini (termasuk '*' jika ada anomali tingkat baris) */
  anomaliesByCol: Record<string, AnomalyItem>;
}

export interface RowMappingResult {
  /** Apakah pemetaan baris ke row_index 100% terverifikasi aman */
  isValid: boolean;
  /** Metode pemetaan yang dipakai */
  method:
    | 'b04_explicit'
    | 'direct_no_drop'
    | 'known_rejected_drop'
    | 'raw_clean_alignment'
    | 'failed';
  /** Penjelasan alasan jika isValid === false (ditampilkan di banner Mode Daftar Anomali) */
  failureReason: string | null;
  /** Daftar baris bersih yang telah terverifikasi (kosong jika isValid === false) */
  verifiedRows: VerifiedCleanRow[];
  /** Peta cepat row_index -> VerifiedCleanRow */
  rowByRowIndex: Record<number, VerifiedCleanRow>;
  /** Himpunan row_index dengan anomali ditolak yang terbukti sudah dibuang dari data bersih */
  droppedRowIndices: number[];
}

export interface RowMappingInput {
  cleanPreviewRows: Array<Record<string, unknown>>;
  explicitRowIndices?: number[];
  rawPreviewRows?: Array<Record<string, unknown>>;
  barisMentah: number;
  barisBersih: number;
  duplikatDihapus: number;
  jumlahReviewDiterapkan: number;
  kolomDiubahKeNumerik?: string[];
  anomalies: AnomalyItem[];
  edits?: DataEditHistoryItem[];
  /**
   * Himpunan row_index dengan anomali ditolak yang terbukti SUDAH DIBUANG
   * menurut hasil klasifikasi pratinjau apply-review (Penyesuaian Wajib butir c & d).
   */
  provenAlreadyDroppedRowIndices?: Set<number>;
}

/** Normalisasi nama kolom sesuai engine.py: str(c).strip().lower().replace(" ", "_") */
function normalizeColName(col: string): string {
  return String(col).trim().toLowerCase().replace(/\s+/g, '_');
}

/** Cek apakah nilai sel dianggap kosong (null / undefined / "") */
function isEmptyCell(val: unknown): boolean {
  return val === null || val === undefined || val === '';
}

/** Ekstrak nilai angka dari alasan outlier: "[outlier] nilai 99999 di luar rentang..." */
function extractOutlierNumberFromAlasan(alasan: string): number | null {
  const match = alasan.match(/^\[outlier\]\s+nilai\s+([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Ekstrak teks asli dari alasan format: "[format] nilai 'abc' bukan angka" */
function extractFormatRawStringFromAlasan(alasan: string): string | null {
  const match = alasan.match(/^\[format\]\s+nilai\s+'(.*)'\s+bukan angka$/);
  return match ? match[1] : null;
}

/** Bandingkan dua nilai sel dengan toleransi angka & normalisasi string */
function areValuesEquivalent(a: unknown, b: unknown): boolean {
  if (isEmptyCell(a) && isEmptyCell(b)) return true;
  if (isEmptyCell(a) || isEmptyCell(b)) return false;

  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= 1e-6;
  }

  const numA = typeof a === 'number' ? a : Number(String(a).trim());
  const numB = typeof b === 'number' ? b : Number(String(b).trim());
  if (
    String(a).trim() !== '' &&
    String(b).trim() !== '' &&
    Number.isFinite(numA) &&
    Number.isFinite(numB)
  ) {
    return Math.abs(numA - numB) <= 1e-6;
  }

  return String(a).trim() === String(b).trim();
}

/**
 * Periksa apakah satu baris RawData kompatibel dengan satu baris CleanData setelah transformasi clean()
 * dan perubahan manual DataEdit pada kandidat row_index tersebut.
 */
function doesRawRowMatchCleanRow(
  rawRow: Record<string, unknown>,
  cleanRow: Record<string, unknown>,
  candidateRowIndex: number,
  convertedNumericCols: Set<string>,
  latestEditsByCell: Map<string, unknown>
): boolean {
  // Buat peta nilai rawRow dengan nama kolom ternormalisasi
  const normalizedRaw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawRow)) {
    normalizedRaw[normalizeColName(k)] = v;
  }

  for (const [col, cleanVal] of Object.entries(cleanRow)) {
    const cellKey = `${candidateRowIndex}::${col}`;

    // Jika sel ini sudah pernah diedit manual, nilai di cleanRow harus cocok dengan nilai_baru terakhir
    if (latestEditsByCell.has(cellKey)) {
      const editedVal = latestEditsByCell.get(cellKey);
      if (!areValuesEquivalent(cleanVal, editedVal)) {
        return false;
      }
      continue;
    }

    const rawVal = normalizedRaw[col];
    const rawTrimmed =
      typeof rawVal === 'string' ? rawVal.trim() : rawVal;
    const isRawEmpty =
      rawTrimmed === null || rawTrimmed === undefined || rawTrimmed === '';

    if (isRawEmpty) {
      if (!isEmptyCell(cleanVal)) return false;
      continue;
    }

    // Jika kolom dikonversi ke numerik oleh engine.py (coerce_numeric)
    if (convertedNumericCols.has(col)) {
      const parsedNum = Number(rawTrimmed);
      if (!Number.isFinite(parsedNum)) {
        // Gagal parse numerik -> di cleanRow menjadi null (NaN) dan dicatat sebagai anomali [format]
        if (!isEmptyCell(cleanVal)) return false;
      } else {
        if (!areValuesEquivalent(cleanVal, parsedNum)) return false;
      }
      continue;
    }

    if (!areValuesEquivalent(cleanVal, rawTrimmed)) {
      return false;
    }
  }

  return true;
}

/**
 * Uji silang satu item anomali terhadap nilai sel pada baris bersih (dan baris mentah jika ada).
 */
function verifyAnomalyAgainstCell(
  anomaly: AnomalyItem,
  cleanRow: Record<string, unknown>,
  rawRow: Record<string, unknown> | undefined,
  latestEditsByCell: Map<string, unknown>
): { ok: boolean; reason?: string } {
  // Anomali tingkat seluruh baris ('*')
  if (anomaly.kolom === '*') {
    return { ok: true };
  }

  if (!(anomaly.kolom in cleanRow)) {
    return {
      ok: false,
      reason: `Kolom "${anomaly.kolom}" pada anomali baris file #${anomaly.baris_di_file_asli} tidak ditemukan di data bersih.`,
    };
  }

  const cellValue = cleanRow[anomaly.kolom];
  const cellKey = `${anomaly.row_index}::${anomaly.kolom}`;

  // Jika anomali sudah berstatus 'diperbaiki', cek terhadap nilai_baru di DataEdit (jika dimuat)
  if (anomaly.status === 'diperbaiki') {
    if (latestEditsByCell.has(cellKey)) {
      const expectedEditedVal = latestEditsByCell.get(cellKey);
      if (!areValuesEquivalent(cellValue, expectedEditedVal)) {
        return {
          ok: false,
          reason: `Nilai sel "${anomaly.kolom}" pada baris file #${anomaly.baris_di_file_asli} tidak cocok dengan riwayat edit terbaru.`,
        };
      }
    }
    return { ok: true };
  }

  // Jika sel sudah diedit di versi sebelumnya tetapi status anomali di-reset (misal setelah ?timpa=true)
  if (anomaly.jenis === 'kosong') {
    if (!isEmptyCell(cellValue)) {
      return {
        ok: false,
        reason: `Uji silang gagal pada baris file #${anomaly.baris_di_file_asli} kolom "${anomaly.kolom}": anomali tercatat [kosong], tetapi sel berisi nilai.`,
      };
    }
    return { ok: true };
  }

  if (anomaly.jenis === 'format') {
    // Pada engine.py, nilai yang gagal diparse ke numerik diubah menjadi NaN (null di JSON clean-preview)
    if (!isEmptyCell(cellValue)) {
      return {
        ok: false,
        reason: `Uji silang gagal pada baris file #${anomaly.baris_di_file_asli} kolom "${anomaly.kolom}": anomali tercatat [format], tetapi sel bersih tidak bernilai kosong/null.`,
      };
    }
    const expectedRawStr = extractFormatRawStringFromAlasan(anomaly.alasan);
    if (expectedRawStr !== null && rawRow) {
      const normalizedRaw: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawRow)) {
        normalizedRaw[normalizeColName(k)] = v;
      }
      const actualRawVal = normalizedRaw[anomaly.kolom];
      const actualRawStr =
        actualRawVal !== null && actualRawVal !== undefined
          ? String(actualRawVal).trim()
          : '';
      if (actualRawStr !== expectedRawStr) {
        return {
          ok: false,
          reason: `Uji silang gagal pada baris file #${anomaly.baris_di_file_asli} kolom "${anomaly.kolom}": nilai mentah tidak cocok dengan alasan anomali format.`,
        };
      }
    }
    return { ok: true };
  }

  if (anomaly.jenis === 'outlier') {
    const expectedNum = extractOutlierNumberFromAlasan(anomaly.alasan);
    if (expectedNum === null) {
      return {
        ok: false,
        reason: `Alasan outlier pada baris file #${anomaly.baris_di_file_asli} tidak memuat angka yang dapat diverifikasi.`,
      };
    }
    const actualNum =
      typeof cellValue === 'number' ? cellValue : Number(cellValue);
    if (isEmptyCell(cellValue) || !Number.isFinite(actualNum)) {
      return {
        ok: false,
        reason: `Uji silang gagal pada baris file #${anomaly.baris_di_file_asli} kolom "${anomaly.kolom}": anomali tercatat [outlier], tetapi sel bukan angka.`,
      };
    }
    if (Math.abs(actualNum - expectedNum) > 1e-4) {
      return {
        ok: false,
        reason: `Uji silang gagal pada baris file #${anomaly.baris_di_file_asli} kolom "${anomaly.kolom}": nilai sel tidak sama dengan angka pada alasan outlier.`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Fungsi utama pemetaan posisi baris `clean-preview` ke `row_index` beserta uji silang anomali.
 * Fungsi murni (pure function): tidak menulis log atau mencetak isi data pengguna.
 */
export function buildVerifiedRowMapping(
  input: RowMappingInput
): RowMappingResult {
  const {
    cleanPreviewRows,
    explicitRowIndices,
    rawPreviewRows,
    barisMentah,
    barisBersih,
    duplikatDihapus,
    jumlahReviewDiterapkan,
    kolomDiubahKeNumerik = [],
    anomalies,
    edits = [],
    provenAlreadyDroppedRowIndices,
  } = input;

  const expectedPreviewCount = Math.min(barisBersih, 200);

  // Syarat 1: Jumlah baris clean-preview harus sesuai dengan dataset.baris_bersih (atau 200 jika dibatasi endpoint)
  if (cleanPreviewRows.length !== expectedPreviewCount) {
    return {
      isValid: false,
      method: 'failed',
      failureReason: `Jumlah baris pratinjau bersih (${cleanPreviewRows.length}) tidak sesuai dengan jumlah baris bersih yang diharapkan (${expectedPreviewCount}).`,
      verifiedRows: [],
      rowByRowIndex: {},
      droppedRowIndices: [],
    };
  }

  if (cleanPreviewRows.length === 0) {
    return {
      isValid: true,
      method: 'direct_no_drop',
      failureReason: null,
      verifiedRows: [],
      rowByRowIndex: {},
      droppedRowIndices: [],
    };
  }

  // Susun peta edit terbaru per (row_index, kolom)
  // Endpoint GET /edits mengembalikan urutan id DESC (terbaru lebih dulu)
  const latestEditsByCell = new Map<string, unknown>();
  for (const edit of edits) {
    const key = `${edit.row_index}::${edit.kolom}`;
    if (!latestEditsByCell.has(key)) {
      latestEditsByCell.set(key, edit.nilai_baru);
    }
  }

  // Kumpulkan semua row_index yang memiliki anomali berstatus 'ditolak'
  const allRejectedRowIndicesSet = new Set<number>();
  for (const a of anomalies) {
    if (a.status === 'ditolak') {
      allRejectedRowIndicesSet.add(a.row_index);
    }
  }

  // Tentukan himpunan row_index dengan anomali ditolak yang terbukti SUDAH DIBUANG:
  // 1) Dari klasifikasi pratinjau apply-review (butir c) jika tersedia, ATAU
  // 2) Dari konsistensi jumlah baris: ketika jumlahReviewDiterapkan > 0, duplikatDihapus === 0,
  //    dan selisih (barisMentah - barisBersih) sama persis dengan jumlah row_index unik berstatus 'ditolak'.
  const totalDroppedRowsCount = Math.max(0, barisMentah - barisBersih);
  const provenDroppedByCountConsistency =
    jumlahReviewDiterapkan > 0 &&
    duplikatDihapus === 0 &&
    totalDroppedRowsCount > 0 &&
    allRejectedRowIndicesSet.size === totalDroppedRowsCount;

  const effectiveDroppedRowIndicesSet = new Set<number>();
  if (provenAlreadyDroppedRowIndices) {
    for (const rIdx of provenAlreadyDroppedRowIndices) {
      if (allRejectedRowIndicesSet.has(rIdx)) {
        effectiveDroppedRowIndicesSet.add(rIdx);
      }
    }
  }
  if (provenDroppedByCountConsistency) {
    for (const rIdx of allRejectedRowIndicesSet) {
      effectiveDroppedRowIndicesSet.add(rIdx);
    }
  }

  let mappedRowIndices: number[] = [];
  let method: RowMappingResult['method'] = 'failed';

  // JALUR 0: B-04 aktif dan mengirim row_indices eksplisit
  if (
    explicitRowIndices &&
    explicitRowIndices.length === cleanPreviewRows.length
  ) {
    mappedRowIndices = [...explicitRowIndices];
    method = 'b04_explicit';
  }
  // JALUR 1: Tidak ada baris yang pernah dibuang (tidak ada duplikat dihapus & belum pernah apply-review)
  else if (
    barisMentah === barisBersih &&
    duplikatDihapus === 0 &&
    jumlahReviewDiterapkan === 0
  ) {
    mappedRowIndices = cleanPreviewRows.map((_, idx) => idx);
    method = 'direct_no_drop';
  }
  // JALUR 1B: Baris yang dibuang semata-mata adalah baris beranomali 'ditolak' yang sudah terbukti dibuang
  // (duplikatDihapus === 0, jumlahReviewDiterapkan > 0, dan jumlah row_index terbuang sama dengan barisMentah - barisBersih)
  else if (
    duplikatDihapus === 0 &&
    jumlahReviewDiterapkan > 0 &&
    effectiveDroppedRowIndicesSet.size === totalDroppedRowsCount
  ) {
    const survivingIndices: number[] = [];
    for (
      let rIdx = 0;
      rIdx < barisMentah && survivingIndices.length < cleanPreviewRows.length;
      rIdx++
    ) {
      if (!effectiveDroppedRowIndicesSet.has(rIdx)) {
        survivingIndices.push(rIdx);
      }
    }

    if (survivingIndices.length !== cleanPreviewRows.length) {
      return {
        isValid: false,
        method: 'failed',
        failureReason:
          'Jumlah baris bertahan setelah dikurangi baris ditolak tidak cocok dengan jumlah baris pratinjau data bersih.',
        verifiedRows: [],
        rowByRowIndex: {},
        droppedRowIndices: [],
      };
    }

    // Jika rawPreviewRows tersedia untuk rentang yang dimuat, verifikasi kecocokan nilai tiap baris terhadap RawData
    if (rawPreviewRows && rawPreviewRows.length > 0) {
      const convertedSet = new Set(
        kolomDiubahKeNumerik.map((c) => normalizeColName(c))
      );
      for (let i = 0; i < cleanPreviewRows.length; i++) {
        const candidateIdx = survivingIndices[i];
        if (candidateIdx < rawPreviewRows.length) {
          const isMatch = doesRawRowMatchCleanRow(
            rawPreviewRows[candidateIdx],
            cleanPreviewRows[i],
            candidateIdx,
            convertedSet,
            latestEditsByCell
          );
          if (!isMatch) {
            return {
              isValid: false,
              method: 'failed',
              failureReason: `Verifikasi baris bersih ke-${i + 1} terhadap Baris File #${candidateIdx + 2} tidak cocok setelah penerapan review.`,
              verifiedRows: [],
              rowByRowIndex: {},
              droppedRowIndices: [],
            };
          }
        }
      }
    }

    mappedRowIndices = survivingIndices;
    method = 'known_rejected_drop';
  }
  // JALUR 2: Ada baris yang dibuang (mis. duplikat di-drop atau kombinasi duplikat + review),
  // gunakan alignment sekuensial RawData -> CleanData
  else {
    if (!rawPreviewRows || rawPreviewRows.length < Math.min(barisMentah, 200)) {
      return {
        isValid: false,
        method: 'failed',
        failureReason:
          'Dataset memiliki baris yang dihapus (duplikat atau review) dan data mentah pembanding belum termuat lengkap untuk memverifikasi nomor baris asli.',
        verifiedRows: [],
        rowByRowIndex: {},
        droppedRowIndices: [],
      };
    }

    if (barisMentah > 200) {
      return {
        isValid: false,
        method: 'failed',
        failureReason:
          'Dataset memiliki lebih dari 200 baris mentah disertai penghapusan baris, sedangkan endpoint pratinjau saat ini dibatasi 200 baris tanpa atribut row_index eksplisit (B-04/B-05).',
        verifiedRows: [],
        rowByRowIndex: {},
        droppedRowIndices: [],
      };
    }

    const convertedSet = new Set(
      kolomDiubahKeNumerik.map((c) => normalizeColName(c))
    );

    let rawCursor = 0;
    for (let i = 0; i < cleanPreviewRows.length; i++) {
      const cleanRow = cleanPreviewRows[i];
      let matchedRawIndex = -1;

      while (rawCursor < rawPreviewRows.length) {
        const candidateIdx = rawCursor;
        const rawRow = rawPreviewRows[candidateIdx];
        rawCursor++;

        // Lewati kandidat RawData jika row_index tersebut sudah terbukti dibuang oleh apply-review
        if (effectiveDroppedRowIndicesSet.has(candidateIdx)) {
          continue;
        }

        if (
          doesRawRowMatchCleanRow(
            rawRow,
            cleanRow,
            candidateIdx,
            convertedSet,
            latestEditsByCell
          )
        ) {
          matchedRawIndex = candidateIdx;
          break;
        }
      }

      if (matchedRawIndex === -1) {
        return {
          isValid: false,
          method: 'failed',
          failureReason: `Tidak dapat mencocokkan baris data bersih ke-${i + 1} dengan urutan baris file asli secara pasti.`,
          verifiedRows: [],
          rowByRowIndex: {},
          droppedRowIndices: [],
        };
      }

      mappedRowIndices.push(matchedRawIndex);
    }

    method = 'raw_clean_alignment';
  }

  // Pastikan row_index naik monotonik dan tidak ada duplikasi
  for (let i = 0; i < mappedRowIndices.length; i++) {
    if (
      !Number.isInteger(mappedRowIndices[i]) ||
      mappedRowIndices[i] < 0 ||
      (i > 0 && mappedRowIndices[i] <= mappedRowIndices[i - 1])
    ) {
      return {
        isValid: false,
        method: 'failed',
        failureReason:
          'Urutan pengenal baris (row_index) hasil pemetaan tidak monotonik atau ambigu.',
        verifiedRows: [],
        rowByRowIndex: {},
        droppedRowIndices: [],
      };
    }
  }

  // Bangun struktur baris terverifikasi sementara
  const rowByRowIndex: Record<number, VerifiedCleanRow> = {};
  const verifiedRows: VerifiedCleanRow[] = cleanPreviewRows.map((row, idx) => {
    const rIdx = mappedRowIndices[idx];
    const item: VerifiedCleanRow = {
      previewIndex: idx,
      rowIndex: rIdx,
      barisDiFileAsli: rIdx + 2,
      data: row,
      anomaliesByCol: {},
    };
    rowByRowIndex[rIdx] = item;
    return item;
  });

  // Jika menggunakan raw_clean_alignment (ketika barisMentah <= 200) dan jumlahReviewDiterapkan > 0,
  // setiap row_index yang memiliki anomali 'ditolak' dan terbukti tidak lagi berada di rowByRowIndex
  // dicatat sebagai sudah dibuang.
  if (
    method === 'raw_clean_alignment' &&
    jumlahReviewDiterapkan > 0 &&
    barisMentah <= 200
  ) {
    for (const rIdx of allRejectedRowIndicesSet) {
      if (!rowByRowIndex[rIdx]) {
        effectiveDroppedRowIndicesSet.add(rIdx);
      }
    }
  }

  const maxLoadedRowIndex =
    mappedRowIndices[mappedRowIndices.length - 1] ?? -1;

  // SYARAT 3: UJI SILANG SETIAP ANOMALI TERHADAP NILAI SEL
  for (const anomaly of anomalies) {
    // Jika dataset > 200 baris dan anomali berada di luar 200 baris pertama yang dimuat clean-preview
    if (barisBersih > 200 && anomaly.row_index > maxLoadedRowIndex) {
      continue;
    }

    const targetRow = rowByRowIndex[anomaly.row_index];
    if (!targetRow) {
      // PENYESUAIAN WAJIB BUTIR d:
      // Pelonggaran Syarat 3 HANYA untuk anomali berstatus 'ditolak' yang terbukti sudah dibuang
      // (menurut butir c atau konsistensi jumlah baris).
      // Anomali berstatus lain yang hilang dari data bersih TETAP menggagalkan pemetaan (Mode Daftar Anomali).
      if (
        anomaly.status === 'ditolak' &&
        jumlahReviewDiterapkan > 0 &&
        effectiveDroppedRowIndicesSet.has(anomaly.row_index)
      ) {
        continue;
      }

      return {
        isValid: false,
        method: 'failed',
        failureReason: `Anomali berstatus "${anomaly.status}" pada Baris File #${anomaly.baris_di_file_asli} (kolom "${anomaly.kolom}") tidak menemukan baris yang cocok di pratinjau data bersih.`,
        verifiedRows: [],
        rowByRowIndex: {},
        droppedRowIndices: [],
      };
    }

    const rawRow =
      rawPreviewRows && anomaly.row_index < rawPreviewRows.length
        ? rawPreviewRows[anomaly.row_index]
        : undefined;

    const crossCheck = verifyAnomalyAgainstCell(
      anomaly,
      targetRow.data,
      rawRow,
      latestEditsByCell
    );

    if (!crossCheck.ok) {
      return {
        isValid: false,
        method: 'failed',
        failureReason:
          crossCheck.reason ||
          `Uji silang nilai sel gagal pada Baris File #${anomaly.baris_di_file_asli} kolom "${anomaly.kolom}".`,
        verifiedRows: [],
        rowByRowIndex: {},
        droppedRowIndices: [],
      };
    }

    targetRow.anomaliesByCol[anomaly.kolom] = anomaly;
  }

  return {
    isValid: true,
    method,
    failureReason: null,
    verifiedRows,
    rowByRowIndex,
    droppedRowIndices: Array.from(effectiveDroppedRowIndicesSet).sort(
      (a, b) => a - b
    ),
  };
}
