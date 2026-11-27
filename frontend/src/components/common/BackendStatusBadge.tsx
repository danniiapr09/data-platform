import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkBackendHealth } from '@/services/healthService';

export const BackendStatusBadge: React.FC = () => {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['backend-health'],
    queryFn: checkBackendHealth,
    refetchInterval: 10000, // Heartbeat setiap 10 detik
    retry: 1,
  });

  const isConnected = !isError && data?.status === 'ok';

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-header-light dark:bg-header-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-text-secondary-light dark:bg-text-secondary-dark animate-pulse flex-shrink-0" />
        <span>Memeriksa Server...</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
        isConnected
          ? 'bg-anomaly-success-bg-light dark:bg-anomaly-success-bg-dark text-anomaly-success-text-light dark:text-anomaly-success-text-dark border-border-light dark:border-border-dark'
          : 'bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark border-border-light dark:border-border-dark'
      }`}
      title={isConnected ? 'Server layanan data aktif dan terhubung' : 'Gagal menghubungi server layanan data'}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isConnected ? 'bg-anomaly-success-text-light dark:bg-anomaly-success-text-dark' : 'bg-anomaly-danger-text-light dark:bg-anomaly-danger-text-dark'
        }`}
      />
      <span>{isConnected ? 'Server Terhubung' : 'Server Terputus'}</span>
    </div>
  );
};
