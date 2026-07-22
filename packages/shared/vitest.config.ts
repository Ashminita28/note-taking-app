import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**'],
      // Type files (SDS §9.2) are `z.infer` re-exports only — no runtime code to cover.
      // Remaining stub `export {}` files (schemas/utils not yet populated by later tickets)
      // have zero coverable statements, so leaving them included is harmless.
      exclude: ['src/types/**'],
    },
  },
});
