import { apiClient } from './apiClient';
import { HealthResponse } from '@/types/api';

/**
 * Pemeriksaan konektivitas server backend (GET /health)
 */
export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}
