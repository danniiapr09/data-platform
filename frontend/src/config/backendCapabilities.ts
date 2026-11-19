/**
 * Saklar Terpusat Kemampuan Backend (Backend Capabilities Feature Flags) - Fase 2
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
} as const;
