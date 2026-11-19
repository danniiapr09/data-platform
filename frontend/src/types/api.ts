/**
 * Definisi tipe data API dan respon HTTP terpusat
 */

export interface HealthResponse {
  status: string;
}

export interface ApiErrorDetail {
  detail?: string;
  error_code?: string;
  field?: string;
  timestamp?: string;
}

export interface ActorHeaders {
  apiKey?: string;
  user?: string;
  role?: string;
}
