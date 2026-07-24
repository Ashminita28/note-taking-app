import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // TipTap + its extensions push the single-page bundle past Vite's default 500kb hint;
    // splitting a small SPA into extra chunks isn't warranted, so the limit is raised instead.
    chunkSizeWarningLimit: 1200,
  },
});
