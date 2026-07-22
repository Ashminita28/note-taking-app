import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**'],
      // Stub files (SDS §9.2) are single-line `export {}` placeholders populated by later
      // tickets (AB-1002, AB-1004, AB-1006–AB-1009) — nothing to unit test yet.
      exclude: ['src/types/**', 'src/schemas/**', 'src/utils/**'],
    },
  },
});
