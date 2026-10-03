# Platform Data & Forecasting

Platform pengolahan data + forecasting untuk pegawai instansi (agama & pendidikan).

## Menjalankan

```bash
cp .env.example .env        # lalu ganti DB_PASSWORD
docker compose up --build
```

- API:  http://localhost:8000/health
- Docs: http://localhost:8000/docs

## Struktur

| Folder | Isi | PIC |
|---|---|---|
| `backend/app/ingestion` | upload & parsing CSV/Excel | Data Engineer |
| `backend/app/cleaning` | aturan cleaning & anomali | Data Engineer |
| `backend/app/analysis` | EDA & statistik | Data Analyst |
| `backend/app/forecasting` | baseline & evaluasi model | ML Engineer |
| `backend/app/api` | routes, auth | Backend |
| `frontend` | dashboard | Backend/Dashboard |
| `config` | aturan cleaning (YAML) | semua |

## Alur Git

`main` (stabil) <- `develop` <- `feature/<modul>-<nama>`. Merge lewat PR, minimal 1 reviewer.
