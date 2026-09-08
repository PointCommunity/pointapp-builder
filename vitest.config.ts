import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // Unit coverage gates the deterministic domain and service core. Route composition and the
      // interactive client are exercised through integration and Playwright journeys instead.
      include: [
        'src/content/**/*.ts',
        'src/domain/**/*.ts',
        'src/server/*.ts',
        'src/server/repositories/**/*.ts',
        'src/server/services/**/*.ts',
      ],
      exclude: ['src/server/app.ts'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
