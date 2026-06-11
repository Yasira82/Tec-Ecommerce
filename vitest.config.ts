import { defineConfig } from 'vitest/config';
import path             from 'path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'happy-dom',
    include:     ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude:     ['node_modules', 'e2e', '.next'],
    coverage: {
      provider: 'v8',
      include:  ['src/**'],
      exclude:  ['src/**/*.{test,spec}.*', 'src/**/__tests__/**'],
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
