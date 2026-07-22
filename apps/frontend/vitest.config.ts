import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**'],
      exclude: [
        'src/main.tsx',
        // Route wiring only — behavior is exercised by the Playwright e2e smoke test.
        'src/App.tsx',
        // Single-heading placeholders rewritten by their owning tickets (AB-1010–AB-1015).
        'src/pages/**',
      ],
    },
  },
});
