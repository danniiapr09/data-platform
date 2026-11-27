import React from 'react';
import { Clock, History } from 'lucide-react';
import { HistoryLogItem } from '@/types/dataset';
import { formatDateTimeId, formatNumberId } from '@/utils/formatters';

interface ProcessingTimelineListProps {
  historyLogs: HistoryLogItem[];
  isLoading: boolean;
  emptyText?: string;
}

/**
 * Komponen Bersama Linimasa Aktivitas Pemrosesan (F-10)
 * Dipakai ulang oleh Tab 1 (DataStructureTab) dan Drawer Riwayat Pemrosesan di Tab 2
 * agar logika perenderan linimasa tidak ditulis dua kali (Penyesuaian Wajib butir e).
 */
export const ProcessingTimelineList: React.FC<ProcessingTimelineListProps> = ({
  historyLogs,
  isLoading,
  emptyText = 'Belum ada catatan aktivitas pemrosesan untuk dataset ini.',
}) => {
  if (isLoading) {
    return (
      <div className="py-6 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
        Memuat riwayat aktivitas pemrosesan...
      </div>
    );
  }

  if (historyLogs.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-text-muted-light dark:text-text-secondary-dark">
        {emptyText}
      </div>
    );
  }

  return (
    <ol className="relative border-l-2 border-border-light dark:border-border-dark ml-3 space-y-4">
      {historyLogs.map((log, index) => (
        <li key={`${log.langkah}-${index}`} className="ml-5">
          <span className="absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full bg-brand-primary-light dark:bg-brand-primary-dark ring-4 ring-surface-light dark:ring-surface-dark" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase bg-header-light dark:bg-header-dark text-brand-primary-light dark:text-brand-primary-dark">
              {log.langkah}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-mono text-text-muted-light dark:text-text-secondary-dark tabular-numbers">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDateTimeId(log.waktu)}</span>
            </span>
          </div>
          <p className="text-sm text-text-primary-light dark:text-text-primary-dark mt-1 font-mono break-words">
            {log.ringkasan}
          </p>
        </li>
      ))}
    </ol>
  );
};

interface ProcessingTimelineCardProps {
  historyLogs: HistoryLogItem[];
  isLoading: boolean;
}

export const ProcessingTimelineCard: React.FC<ProcessingTimelineCardProps> = ({
  historyLogs,
  isLoading,
}) => {
  return (
    <div className="rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-brand-cyan" />
          <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
            Linimasa Aktivitas Pemrosesan
          </h3>
        </div>
        <span className="text-xs text-text-muted-light dark:text-text-secondary-dark tabular-numbers">
          {formatNumberId(historyLogs.length, 0)} langkah tercatat
        </span>
      </div>

      <ProcessingTimelineList
        historyLogs={historyLogs}
        isLoading={isLoading}
      />
    </div>
  );
};
