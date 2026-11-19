/**
 * Definisi tipe data entitas dataset, skema, dan status verifikasi anomali
 */

export type AnomalyStatus = 'diterima' | 'pending' | 'ditolak' | 'diperbaiki';

export interface DatasetItem {
  id: string;
  name: string;
  format: 'csv' | 'xlsx';
  rowCount?: number;
  colCount?: number;
  fileSizeBytes?: number;
  uploadedAt?: string;
  statusCleaned?: boolean;
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  nullCount: number;
  uniqueCount: number;
  sampleValue?: string | number | null;
  description?: string;
}
