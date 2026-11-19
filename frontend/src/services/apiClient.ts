import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorDetail } from '@/types/api';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interseptor Request: Sisipkan X-API-Key, X-User, X-Role jika dikonfigurasi
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const apiKey = import.meta.env.VITE_INTERNAL_API_KEY;
    if (apiKey) {
      config.headers.set('X-API-Key', apiKey);
    }
    // Header identitas default pegawai instansi untuk mode pengembangan
    if (!config.headers.has('X-User')) {
      config.headers.set('X-User', 'pegawai_instansi');
    }
    if (!config.headers.has('X-Role')) {
      config.headers.set('X-Role', 'admin');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interseptor Response: Tangani error global dengan pesan Bahasa Indonesia yang edukatif
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorDetail>) => {
    let userMessage = 'Terjadi kesalahan sistem yang tidak terduga.';

    if (!error.response) {
      userMessage =
        'Koneksi ke server backend terputus. Pastikan server aktif di ' + baseURL;
    } else {
      const status = error.response.status;
      const serverDetail = error.response.data?.detail;

      switch (status) {
        case 400:
          userMessage =
            serverDetail ||
            'Permintaan data tidak valid. Silakan periksa kembali parameter input.';
          break;
        case 401:
          userMessage =
            'Autentikasi gagal atau API key tidak valid. Akses ke sistem ditolak.';
          break;
        case 403:
          userMessage =
            'Aksi ditolak. Peran (role) akun Anda tidak memiliki izin untuk tindakan ini.';
          break;
        case 404:
          userMessage =
            'Data atau sumber daya yang diminta tidak ditemukan di server backend.';
          break;
        case 409:
          userMessage =
            serverDetail ||
            'Terjadi konflik data (misalnya data sudah pernah diproses). Periksa opsi penimpaan.';
          break;
        case 422:
          userMessage =
            'Entitas data tidak dapat diproses. Format berkas atau struktur skema tidak sesuai.';
          break;
        case 500:
          userMessage =
            'Terjadi kesalahan internal pada server backend. Silakan hubungi administrator.';
          break;
        default:
          userMessage =
            serverDetail || `Terjadi kesalahan dengan kode status HTTP ${status}.`;
      }
    }

    // Tempelkan pesan yang telah dilokalisasi ke objek error
    (error as Error & { localizedMessage?: string }).localizedMessage = userMessage;
    return Promise.reject(error);
  }
);
