/**
 * Saklar Terpusat Kemampuan Backend (Backend Capabilities Feature Flags) - Fase 2 s/d 6
 *
 * Seluruh saklar bernilai `false` secara default sampai endpoint atau perluasan payload
 * diimplementasikan dan diverifikasi bersama pengembang backend.
 */

export const BACKEND_CAPABILITIES = {
  /**
   * B-01: Pendaftaran Router Ringkasan di `backend/app/main.py`
   * - Endpoint yang dibutuhkan: `GET /ringkasan`
   * - Bentuk respons yang diharapkan (sesuai `backend/app/api/ringkasan.py` & PRD Bagian 12):
   *   {
   *     jumlah_dataset: number;
   *     per_status: { uploaded: number; cleaned: number; forecasted: number };
   *     anomali_pending: number;
   *     dataset_dengan_pending: number;
   *     pending_teratas: Array<{ dataset_id: number; nama: string; pending: number }>;
   *   }
   * - Status: belum diverifikasi dengan backend (router ada di berkas, belum didaftarkan di main.py).
   * - Perilaku saat false: Beranda menyusun metrik dari `GET /datasets` + `GET /datasets/{id}`
   *   secara paralel terbatas (maksimal 5 request sekaligus).
   */
  B01_RINGKASAN_ENDPOINT: false,

  /**
   * B-02: Saluran Pembaruan Real-Time (WebSocket atau Server-Sent Events)
   * - Endpoint yang dibutuhkan: `WS /ws/datasets/{dataset_id}` atau `GET /datasets/{dataset_id}/events`
   * - Bentuk pesan event yang diharapkan (sesuai usulan B-02 PRD Bagian 12):
   *   {
   *     event: 'cleaned' | 'anomaly_reviewed' | 'data_edited' | 'review_applied' | 'forecasted';
   *     dataset_id: number;
   *     versi_bersih: number | null;
   *     timestamp: string;
   *   }
   * - Status: belum tersedia di backend.
   * - Perilaku saat false: Header Workspace menampilkan indikator kesegaran data React Query
   *   ("Data terkini" dengan titik status statis, atau "Menyegarkan..." dengan animasi putar saat fetch)
   *   tanpa menampilkan teks "Live Sync", dan setiap mutasi menyegarkan query terkait secara reaktif.
   */
  B02_LIVE_SYNC_CHANNEL: false,

  /**
   * B-03: Endpoint Profil Kolom Permanen & Kamus Data (Data Dictionary)
   * - Endpoint yang dibutuhkan: `GET /datasets/{dataset_id}/columns`
   * - Bentuk respons yang diharapkan (sesuai usulan B-03 PRD Bagian 12):
   *   {
   *     dataset_id: number;
   *     versi: number;
   *     kolom: Array<{
   *       kolom: string;
   *       tipe: string;
   *       kosong: number;
   *       unik: number;
   *       contoh: string[];
   *       deskripsi: string | null;
   *     }>;
   *   }
   * - Status: belum diverifikasi dengan backend.
   * - Perilaku saat false:
   *   - Pada toggle Data Mentah (v0): memakai profil hasil upload dari cache memori React Query
   *     (jika ada) atau daftar kolom & sampel dari `GET /datasets/{id}/preview`, dengan "-"
   *     untuk metrik yang tidak tersedia dan "-" untuk kolom Deskripsi.
   *   - Pada toggle Data Bersih (v{versi}): memakai `kosong_per_kolom` dari `clean-report` dan
   *     sampel dari `clean-preview`, serta "-" untuk nilai unik dan kolom Deskripsi.
   */
  B03_COLUMN_DICTIONARY_ENDPOINT: false,

  /**
   * B-04: Penyertaan Field `row_index` Eksplisit pada Preview Data Bersih
   * - Endpoint yang dibutuhkan: `GET /datasets/{dataset_id}/clean-preview`
   * - Bentuk respons yang diharapkan (sesuai usulan B-04 PRD Bagian 12):
   *   {
   *     dataset_id: number;
   *     versi: number;
   *     preview: Array<Record<string, unknown> & { __row_index?: number; row_index?: number }>;
   *     row_indices?: number[];
   *   }
   * - Status: belum tersedia di backend (`cleaning.py` saat ini mengembalikan `[r.row_json for r in rows]`).
   * - Perilaku saat false: Frontend menjalankan fungsi murni pemetaan & uji silang deterministik
   *   (`rowIndexMapper.ts`). Jika ada satu saja anomali yang tidak lulus uji silang nilai sel atau ambigu,
   *   tampilan otomatis beralih ke "Mode Daftar Anomali" agar tidak pernah mewarnai atau mengedit baris yang salah.
   */
  B04_CLEAN_PREVIEW_ROW_INDEX: false,

  /**
   * B-05: Endpoint Grid Data Terpadu dengan Penanda Anomali per Sel
   * - Endpoint yang dibutuhkan: `GET /datasets/{dataset_id}/data-review`
   * - Parameter query yang diharapkan: `limit`, `offset`, `status`, `jenis`, `kolom`, `q`
   * - Bentuk respons yang diharapkan (sesuai usulan B-05 PRD Bagian 12):
   *   {
   *     dataset_id: number;
   *     versi: number;
   *     total_baris: number;
   *     limit: number;
   *     offset: number;
   *     rows: Array<{
   *       row_index: number;
   *       baris_di_file_asli: number;
   *       data: Record<string, unknown>;
   *       anomali: Record<string, {
   *         id: number;
   *         row_index: number;
   *         baris_di_file_asli: number;
   *         kolom: string;
   *         jenis: string;
   *         alasan: string;
   *         status: 'pending' | 'diterima' | 'ditolak' | 'diperbaiki';
   *       }>;
   *     }>;
   *   }
   * - Status: belum tersedia di backend.
   * - Perilaku saat false: Menggabungkan `GET /datasets/{id}/clean-preview?limit=200`,
   *   `GET /datasets/{id}/anomalies/items`, dan `GET /datasets/{id}/edits` dengan verifikasi
   *   keselamatan pengenal baris di sisi klien.
   */
  B05_UNIFIED_DATA_REVIEW_ENDPOINT: false,

  /**
   * B-06: Rincian Isi Baris Aktual pada Respons Diff Apply Review
   * - Endpoint yang dibutuhkan: `POST /datasets/{dataset_id}/apply-review?preview=true`
   * - Bentuk perluasan respons yang diharapkan (sesuai usulan B-06 PRD Bagian 12):
   *   {
   *     ...field_apply_review,
   *     detail_baris_dibuang: Array<{
   *       row_index: number;
   *       baris_di_file_asli: number;
   *       alasan: string[];
   *       kolom?: string[];
   *       row_json?: Record<string, unknown>;
   *     }>;
   *     rows?: Array<{
   *       row_index: number;
   *       baris_di_file_asli: number;
   *       row_json: Record<string, unknown>;
   *       alasan: string[];
   *     }>;
   *   }
   * - Status: belum tersedia di backend (`review.py` saat ini mengembalikan `row_index`,
   *   `baris_di_file_asli`, dan `alasan` pada `detail_baris_dibuang`).
   * - Perilaku saat false: Modal konfirmasi dua langkah dan panel perbandingan menampilkan
   *   `baris_di_file_asli`, `kolom` (dari daftar anomali ditolak pada `row_index` tersebut),
   *   dan `alasan` dari backend, serta menyertakan cuplikan isi baris HANYA JIKA pemetaan
   *   baris (`rowIndexMapper`) berstatus valid (`isValid === true`) dan `row_index` terkait
   *   terverifikasi di dalam pratinjau data bersih.
   */
  B06_APPLY_REVIEW_DIFF_ROWS: false,

  /**
   * B-07: Endpoint Agregasi Hierarki & Matriks 2D untuk Galeri Diagram (Fase 5)
   * - Endpoint yang dibutuhkan:
   *   1) `GET /datasets/{dataset_id}/analysis/hierarchy`
   *      Parameter query: `levels: string` (daftar kolom dipisah koma), `nilai: string`, `agg?: 'sum' | 'mean' | 'median' | 'min' | 'max'`
   *      Bentuk respons yang diharapkan:
   *      {
   *        dataset_id: number;
   *        levels: string[];
   *        nilai: string;
   *        agg: string;
   *        root: {
   *          name: string;
   *          value?: number;
   *          children?: Array<{ name: string; value?: number; children?: unknown[] }>;
   *        };
   *      }
   *   2) `GET /datasets/{dataset_id}/analysis/matrix`
   *      Parameter query: `baris: string`, `kolom: string`, `nilai: string`, `agg?: 'sum' | 'mean' | 'median' | 'min' | 'max'`
   *      Bentuk respons yang diharapkan:
   *      {
   *        dataset_id: number;
   *        baris: string;
   *        kolom: string;
   *        nilai: string;
   *        agg: string;
   *        label_baris: string[];
   *        label_kolom: string[];
   *        nilai_matriks: Array<Array<number | null>>;
   *        min: number | null;
   *        max: number | null;
   *      }
   * - Status: belum tersedia di backend (diusulkan di PRD Bagian 12 butir 7).
   * - Perilaku saat false: Kartu Heatmap Matriks 2D (Kategori × Kategori), Hierarchy Bubbles
   *   (Circle Packing), dan Hierarchy Sunburst ditampilkan di bagian bawah galeri dalam keadaan
   *   nonaktif dengan keterangan "Menunggu dukungan backend (B-07)" tanpa memalsukan data.
   */
  B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT: false,

  /**
   * B-08: Perluasan Metadata Katalog Dataset (`GET /datasets`)
   * - Endpoint yang dibutuhkan: `GET /datasets` (perluasan field per item)
   * - Bentuk respons yang diharapkan (sesuai usulan B-08 PRD Bagian 12):
   *   Array<{
   *     id: number;
   *     nama: string;
   *     jenis: string;
   *     status: 'uploaded' | 'cleaned' | 'forecasted';
   *     uploaded_at: string;
   *     format?: 'csv' | 'xlsx' | 'xls';
   *     file_size_bytes?: number;
   *     sheet_name?: string | null;
   *     jumlah_baris?: number;
   *     jumlah_kolom?: number;
   *     anomali_pending?: number;
   *   }>
   * - Status: belum diverifikasi dengan backend.
   * - Perilaku saat false:
   *   - Kolom Dimensi Data di Katalog menampilkan "-".
   *   - Kolom Anomali di Katalog menampilkan "Belum diproses" untuk status `uploaded`,
   *     dan "-" untuk status lainnya (tanpa memanggil GET /datasets/{id} per baris).
   *   - Badge format berkas diambil dari ekstensi `nama` hanya jika ada; disembunyikan jika tidak ada.
   */
  B08_CATALOG_EXTENDED_METADATA: false,

  /**
   * B-09: Metrik Rata-rata Kelengkapan Global & Histori Pembaruan pada `GET /ringkasan`
   * - Endpoint yang dibutuhkan: `GET /ringkasan` (perluasan field)
   * - Bentuk respons yang diharapkan (sesuai usulan B-09 PRD Bagian 12):
   *   {
   *     ...field_B01,
   *     rata_rata_kelengkapan_persen: number | null;
   *     terakhir_diperbarui: string | null;
   *   }
   * - Status: belum diverifikasi dengan backend.
   * - Perilaku saat false: Kartu ke-4 ("Rata-rata Kelengkapan Data") di Beranda disembunyikan;
   *   hanya 3 kartu inti F-01 yang ditampilkan.
   */
  B09_GLOBAL_COMPLETENESS_METRIC: false,

  /**
   * B-10: Endpoint Ekspor CSV Penuh untuk Data Mentah dan Data Bersih
   * - Endpoint yang dibutuhkan:
   *   - `GET /datasets/{dataset_id}/export/raw.csv` (unduhan CSV utuh data mentah v0)
   *   - `GET /datasets/{dataset_id}/export/clean.csv` (unduhan CSV utuh data bersih versi aktif)
   * - Bentuk respons yang diharapkan: Stream berkas `text/csv` dengan header `Content-Disposition: attachment`.
   * - Status: belum diverifikasi dengan backend.
   * - Perilaku saat false: Tombol "Ekspor CSV Cepat" dan "Unduh Data Mentah (v0)" di Tab 1
   *   ditampilkan dalam keadaan nonaktif (`aria-disabled="true"`) disertai tooltip aksesibel
   *   saat hover dan fokus keyboard.
   */
  B10_FULL_CSV_EXPORT_ENDPOINT: false,

  /**
   * B-12: Format Terstandar untuk Respon Error HTTP
   * - Bentuk respons error JSON yang diharapkan (sesuai usulan B-12 PRD Bagian 12):
   *   {
   *     detail: string;
   *     error_code?: string;
   *     field?: string;
   *     timestamp?: string;
   *   }
   * - Status: belum tersedia penuh di seluruh router backend (saat ini FastAPI mengembalikan `{ detail: string }`).
   * - Perilaku saat false: Interseptor `apiClient` membaca `error.response.data?.detail` dan
   *   memetakan kode status HTTP (400, 401, 403, 404, 409, 422, 500) ke pesan Bahasa Indonesia.
   */
  B12_STANDARD_ERROR_FORMAT: false,

  /**
   * B-13: Penanda Versi Data Bersih Eksplisit pada Hasil Peramalan Tersimpan (Fase 6)
   * - Endpoint yang terkait:
   *   - `POST /datasets/{dataset_id}/forecast`
   *   - `GET /datasets/{dataset_id}/forecast/laporan`
   *   - `GET /datasets/{dataset_id}`
   * - Bentuk perluasan kontrak yang diharapkan:
   *   {
   *     ...field_forecast_laporan,
   *     versi_bersih: number; // versi CleanData yang dipakai saat peramalan dihitung
   *     is_forecast_stale?: boolean;
   *   }
   * - Status: perbaikan opsional (saat ini `Forecast` dan log `forecast_report` di `forecast.py`
   *   belum menyimpan nomor `versi_bersih` saat peramalan dihitung).
   * - Perilaku saat false: Frontend mendeteksi peramalan usang secara persisten dan deterministik
   *   dari urutan kronologis `GET /datasets/{id}/history` (memeriksa apakah terdapat langkah
   *   `cleaning`, `edit_data`, atau `apply_review` setelah langkah `forecasting` terakhir).
   *   Ketika saklar ini diaktifkan (`true`), frontend juga memeriksa `laporan.versi_bersih !== dataset.versi_bersih`.
   */
  B13_FORECAST_DATA_VERSION: false,
} as const;
