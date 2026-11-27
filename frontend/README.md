# Frontend — Platform Data & Forecasting

Antarmuka web desktop (1280×720 hingga 1920×1080) untuk pengelolaan, pembersihan, review anomali, analisis eksploratif, dan peramalan data tabular instansi.

## Stack Teknologi
- **React 18** + **TypeScript** + **Vite 5**
- **Tailwind CSS 3** (Light Mode & Dark Mode *Obsidian Data Mode*, token di `docs/design-system.md`)
- **React Router v6**, **TanStack Query v5**, **Axios**
- **Recharts** & **Lucide Icons**
- **Font lokal**: `@fontsource/plus-jakarta-sans` & `@fontsource/jetbrains-mono` (dengan `tabular-nums`)

> **Catatan Ekspor Grafik PNG/SVG (`src/utils/chartExporter.ts`):** Ekspor berjalan 100% di sisi klien tanpa permintaan jaringan. Berkas SVG/PNG memakai tumpukan font cadangan sistem (`Plus Jakarta Sans` / `Segoe UI` dan `JetBrains Mono` / `Consolas`) dengan `font-variant-numeric: tabular-nums` agar ukuran berkas ringan, stabil lintas browser, dan bebas risiko *canvas tainting*.

---

## Cara Menjalankan (Pengembangan & Build)

Jalankan perintah dari direktori `frontend/`:

```powershell
cd frontend
npm install
npm run dev      # Server pengembangan di http://localhost:5173
```

Pemeriksaan tipe dan build produksi:

```powershell
cd frontend
npm run lint     # Pemeriksaan TypeScript (tsc --noEmit)
npm run build    # Build produksi ke frontend/dist/
```

---

## Variabel Lingkungan (`frontend/.env`)

Buat berkas `frontend/.env` secara lokal (jangan pernah di-commit ke Git). Daftar nama variabel yang didukung:

| Nama Variabel | Wajib? | Keterangan |
|---|---|---|
| `VITE_API_BASE_URL` | Opsional | Alamat dasar API backend FastAPI (default: `http://localhost:8000`). |
| `VITE_INTERNAL_API_KEY` | Opsional | Kunci API internal jika backend mengaktifkan verifikasi `X-API-Key`. Biarkan kosong pada mode pengembangan tanpa kunci. |

---

## Tabel Saklar Kemampuan Backend (`src/config/backendCapabilities.ts`)

Seluruh saklar bernilai `false` secara default hingga endpoint terkait tersedia dan diverifikasi bersama tim backend.

| Kode | Nama Saklar | Endpoint / Kontrak Backend | Perilaku Saat `false` (Default) |
|---|---|---|---|
| **B-01** | `B01_RINGKASAN_ENDPOINT` | `GET /ringkasan` | Beranda menghitung ringkasan dari `GET /datasets` + `GET /datasets/{id}` (konkurensi maks. 5). |
| **B-02** | `B02_LIVE_SYNC_CHANNEL` | `WS /ws/datasets/{id}` atau SSE `/events` | Header menampilkan kesegaran data React Query (`Data terkini`) dengan penyegaran reaktif pasca-mutasi. |
| **B-03** | `B03_COLUMN_DICTIONARY_ENDPOINT` | `GET /datasets/{id}/columns` | Tab 1 memakai profil upload di cache memori atau `preview`/`clean-report`, menampilkan `-` untuk deskripsi. |
| **B-04** | `B04_CLEAN_PREVIEW_ROW_INDEX` | `row_index` eksplisit di `GET /clean-preview` | Memakai `rowIndexMapper.ts`; otomatis fallback aman ke Mode Daftar Anomali jika pemetaan ambigu. |
| **B-05** | `B05_UNIFIED_DATA_REVIEW_ENDPOINT` | `GET /datasets/{id}/data-review` | Menggabungkan `clean-preview` (maks. 200 baris), `anomalies/items`, dan `edits` di sisi klien. |
| **B-06** | `B06_APPLY_REVIEW_DIFF_ROWS` | `rows` aktual di `POST /apply-review?preview=true` | Menampilkan nomor baris asli, kolom, dan alasan; isi baris hanya tampil jika terverifikasi di pratinjau. |
| **B-07** | `B07_HIERARCHY_MATRIX_ANALYSIS_ENDPOINT` | `GET /analysis/matrix` & `/analysis/hierarchy` | Kartu Heatmap 2D, Hierarchy Bubbles, dan Sunburst ditampilkan terkunci dengan keterangan edukatif. |
| **B-08** | `B08_CATALOG_EXTENDED_METADATA` | Metadata tambahan per item di `GET /datasets` | Kolom Dimensi & Anomali di Katalog menampilkan `-` atau `Belum diproses`. |
| **B-09** | `B09_GLOBAL_COMPLETENESS_METRIC` | Rata-rata kelengkapan global di `GET /ringkasan` | Kartu ke-4 di Beranda disembunyikan; hanya 3 kartu inti yang tampil. |
| **B-10** | `B10_FULL_CSV_EXPORT_ENDPOINT` | `GET /export/raw.csv` & `/export/clean.csv` | Tombol ekspor CSV penuh di Tab 1 berstatus nonaktif aksesibel dengan tooltip penjelas. |
| **B-11** | *(Fase 8 — belum aktif)* | `POST /auth/login` & `GET /auth/me` | Ditunda ke Fase 8 (autentikasi & RBAC). Header pengembangan default dikirim via `apiClient`. |
| **B-12** | `B12_STANDARD_ERROR_FORMAT` | Payload error JSON terstandar | `apiClient` membaca `detail` FastAPI dan memetakan status HTTP ke pesan Bahasa Indonesia. |
| **B-13** | `B13_FORECAST_DATA_VERSION` | `versi_bersih` pada hasil peramalan | Deteksi peramalan usang dihitung deterministik dari kronologi `GET /datasets/{id}/history`. |
| **B-14** | *(Dicadangkan)* | Belum didefinisikan di PRD | Tidak aktif. |

---

## Struktur Folder `frontend/`

```text
frontend/
├── docs/                        # Acuan PRD.md & design-system.md (read-only saat implementasi)
├── public/                      # Aset statis (favicon.svg)
├── src/
│   ├── components/
│   │   ├── analytics/           # Kartu grafik Tab 3, matriks korelasi, pemilih kolom, modal layar penuh
│   │   ├── common/              # Button, StatusBadge, Toast, ThemeToggle, AccessibleModalDialog, AppErrorBoundary
│   │   ├── forecast/            # Form konfigurasi, grafik proyeksi, papan peringkat model, pusat ekspor
│   │   ├── navigation/          # Sidebar global & WorkspaceHeader (breadcrumb + 4 tab)
│   │   └── review/              # Modal Apply Review, CleanConflictModal, InlineCellEditorPopover, Drawer Audit/Riwayat
│   ├── config/                  # Saklar backendCapabilities.ts
│   ├── context/                 # WorkspaceTabStateContext.tsx (state antar-tab memori React)
│   ├── hooks/                   # useDocumentTitle.ts
│   ├── layouts/                 # MainLayout.tsx & WorkspaceLayout.tsx
│   ├── pages/                   # HomePage, CatalogPage, UploadPage, NotFoundPage, dan workspace/* (Tab 1-4)
│   ├── services/                # apiClient, datasetService, analyticsService, forecastService, healthService
│   ├── types/                   # Definisi tipe TypeScript (api, dataset, analytics, forecast)
│   └── utils/                   # formatters.ts, chartExporter.ts, rowIndexMapper.ts
├── index.html
├── tailwind.config.ts
└── vite.config.ts
```
