import { defineConfig } from 'vitest/config';
import path             from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include:     ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude:     ['node_modules', 'e2e', '.next'],
    // TEC-AUDIT-0037 — a RATCHET below the fleet's 60/60/60/50. Measured 13 Nov 2026 over EVERY
    // file in src/ (an untested file counts as 0, not as absent): 34.8 statements · 29.29 branches · 27.12 functions · 38.46 lines.
    // Set at what it passes today so it can only go up; raise each number as tests are added.
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'json-summary'],
      include:    ['src/**/*.{ts,tsx}'],
      exclude:    ['**/*.test.*', '**/*.spec.*', '**/__tests__/**', 'e2e/**'],
      thresholds: { lines: 38, functions: 27, statements: 34, branches: 29 },
    },
  },
  // Next compiles JSX with the automatic runtime; without this, a rendered
  // component fails in tests with "React is not defined".
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
