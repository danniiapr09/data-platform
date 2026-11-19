import React from 'react';
import { Outlet } from 'react-router-dom';
import { WorkspaceHeader } from '@/components/navigation/WorkspaceHeader';

export const WorkspaceLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-canvas-light dark:bg-canvas-dark text-text-primary-light dark:text-text-primary-dark">
      {/* Header Khusus Workspace: Breadcrumb, Metadata, dan 4 Tab */}
      <WorkspaceHeader />

      {/* Konten Tab Workspace (Layar Penuh / Full-Width Desktop) */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
