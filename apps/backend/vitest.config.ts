import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration suites truncate overlapping tables (User, RefreshToken) against one real
    // Postgres test DB — running test files concurrently races those truncations across suites.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://notetaking:notetaking@localhost:5433/notetaking_test',
      JWT_SECRET: 'test-secret-do-not-use-in-production',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    coverage: {
      include: ['src/**'],
      // server.ts is a bootstrap entrypoint (starts listening) — nothing to unit test.
      // *.d.ts files are ambient type declarations only — no runtime code to cover.
      exclude: ['src/server.ts', 'src/**/*.d.ts'],
    },
  },
});
