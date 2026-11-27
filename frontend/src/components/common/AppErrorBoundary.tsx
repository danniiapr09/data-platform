import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/common/Button';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  scopeLabel?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Error Boundary untuk menangkap kegagalan render runtime agar aplikasi
 * tidak berubah menjadi layar kosong dan pengguna tetap dapat memulihkan sesi.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kendala saat menampilkan halaman.',
    };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, errorMessage: null });
    window.location.assign('/beranda');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-canvas-light dark:bg-canvas-dark">
          <div
            role="alert"
            className="max-w-lg w-full p-8 rounded-card bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-anomaly-danger-bg-light dark:bg-anomaly-danger-bg-dark text-anomaly-danger-text-light dark:text-anomaly-danger-text-dark flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                Terjadi Kesalahan Tampilan
                {this.props.scopeLabel ? ` (${this.props.scopeLabel})` : ''}
              </h1>
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Halaman tidak dapat ditampilkan karena kendala teknis sementara.
                Data Anda di server tetap aman.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={this.handleReload}
              >
                Muat Ulang Halaman
              </Button>
              <Button
                variant="secondary"
                icon={<Home className="w-4 h-4" />}
                onClick={this.handleGoHome}
              >
                Kembali ke Beranda
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
