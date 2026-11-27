import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorDetail } from '@/types/api';
import { showToast } from '@/components/common/Toast';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Jika true, interseptor global tidak memunculkan toast error (ditangani komponen/modal) */
    skipErrorToast?: boolean;
  }
}

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
    if (apiKey && String(apiKey).trim() !== '') {
      config.headers.set('X-API-Key', String(apiKey).trim());
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
        'Tidak dapat terhubung ke server layanan data. Periksa koneksi jaringan atau pastikan server sedang aktif.';
    } else {
      const status = error.response.status;
      const serverDetail = error.response.data?.detail;
      const configuredApiKey = import.meta.env.VITE_INTERNAL_API_KEY;
      const isApiKeyEmpty =
        !configuredApiKey || String(configuredApiKey).trim() === '';

      switch (status) {
        case 400:
          userMessage =
            serverDetail ||
            'Permintaan tidak dapat diproses karena data atau pilihan belum sesuai. Silakan periksa kembali isian Anda.';
          break;
        case 401:
          if (isApiKeyEmpty) {
            userMessage =
              'Akses belum terverifikasi. Silakan hubungi administrator untuk mengaktifkan kunci akses aplikasi.';
          } else {
            userMessage =
              'Verifikasi akses ditolak oleh server. Periksa kembali kredensial akses atau hubungi administrator.';
          }
          break;
        case 403:
          userMessage =
            'Aksi ditolak. Peran akun Anda tidak memiliki izin untuk melakukan tindakan ini.';
          break;
        case 404:
          userMessage =
            serverDetail ||
            'Data yang diminta tidak ditemukan. Pastikan dataset masih tersedia di katalog.';
          break;
        case 409:
          userMessage =
            serverDetail ||
            'Terjadi bentrokan versi data karena dataset sudah memiliki perubahan sebelumnya. Tinjau opsi konfirmasi sebelum melanjutkan.';
          break;
        case 422:
          userMessage =
            serverDetail ||
            'Format berkas atau nilai yang dikirim belum sesuai. Silakan periksa kembali data Anda.';
          break;
        case 500:
          userMessage =
            'Terjadi kendala pada server saat memproses permintaan. Silakan coba beberapa saat lagi atau hubungi administrator.';
          break;
        default:
          userMessage =
            serverDetail || `Permintaan gagal diproses (kode status ${status}). Silakan coba lagi.`;
      }
    }

    // Tempelkan pesan yang telah dilokalisasi ke objek error
    (error as Error & { localizedMessage?: string }).localizedMessage = userMessage;

    // Tampilkan toast error kecuali untuk polling background /health atau jika skipErrorToast aktif
    const reqUrl = error.config?.url || '';
    const skipToast = Boolean(error.config?.skipErrorToast);
    if (reqUrl !== '/health' && !skipToast) {
      showToast(userMessage, 'error');
    }

    return Promise.reject(error);
  }
);
