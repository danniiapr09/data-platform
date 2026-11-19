import React from 'react';
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { DatasetProcessingStatus } from '@/types/dataset';
import { extractFileExtensionBadge, normalizeDataTypeLabel } from '@/utils/formatters';

interface ProcessingStatusBadgeProps {
  status: DatasetProcessingStatus | string;
}

/**
 * Lencana status pemrosesan dataset (Uploaded, Cleaned, Forecasted)
 * menggunakan token design-system.md beserta ikon penanda non-warna.
 */
export const ProcessingStatusBadge: React.FC<ProcessingStatusBadgeProps> = ({ status }) => {
  const normalized = status?.toLowerCase();

  if (normalized === 'cleaned') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Cleaned</span>
      </span>
    );
  }

  if (normalized === 'forecasted') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-cyan/15 text-brand-primary-light dark:text-brand-primary-dark">
        <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Forecasted</span>
      </span>
    );
  }

  // Default: uploaded
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark">
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Uploaded</span>
    </span>
  );
};

interface FormatFileBadgeProps {
  namaDataset: string | null | undefined;
  explicitFormat?: string | null;
}

/**
 * Badge format berkas (CSV / XLSX / XLS) di samping nama dataset.
 * Hanya tampil jika nama dataset memiliki ekstensi valid (atau explicitFormat dari B-08).
 * Jika tidak ada ekstensi, disembunyikan (tidak menebak).
 */
export const FormatFileBadge: React.FC<FormatFileBadgeProps> = ({
  namaDataset,
  explicitFormat,
}) => {
  const ext = extractFileExtensionBadge(namaDataset, explicitFormat);
  if (!ext) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-xs font-semibold bg-brand-cyan/15 text-brand-cyan flex-shrink-0">
      {ext}
    </span>
  );
};

interface DataTypeBadgeProps {
  rawType: string | null | undefined;
}

/**
 * Badge tipe data kolom (integer, decimal, date, text) dengan font JetBrains Mono
 */
export const DataTypeBadge: React.FC<DataTypeBadgeProps> = ({ rawType }) => {
  const typeLabel = normalizeDataTypeLabel(rawType);

  let colorClass =
    'bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark';

  if (typeLabel === 'integer') {
    colorClass =
      'bg-brand-primary-light/10 dark:bg-brand-primary-dark/15 text-brand-primary-light dark:text-brand-primary-dark border-brand-primary-light/20 dark:border-brand-primary-dark/30';
  } else if (typeLabel === 'decimal') {
    colorClass =
      'bg-brand-violet/10 text-brand-violet border-brand-violet/25';
  } else if (typeLabel === 'date') {
    colorClass =
      'bg-anomaly-warning-bg-light dark:bg-anomaly-warning-bg-dark text-anomaly-warning-text-light dark:text-anomaly-warning-text-dark border-anomaly-warning-text-light/20';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs font-medium border ${colorClass}`}
    >
      {typeLabel}
    </span>
  );
};
