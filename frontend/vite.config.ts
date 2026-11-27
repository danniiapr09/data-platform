import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('/react/') ||
              id.includes('\\react\\')
            ) {
              return 'react-vendor';
            }
            if (id.includes('@tanstack/react-query') || id.includes('axios')) {
              return 'query-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
          }
          return undefined;
        },
      },
    },
  },
});
