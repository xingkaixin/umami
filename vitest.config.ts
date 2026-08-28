import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'cloudflare:workers': fileURLToPath(new URL('./src/test/cloudflare.ts', import.meta.url)),
    },
  },
  test: {
    env: { APP_SECRET: 'umami-test-only-secret' },
    maxWorkers: 4,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/db/**/*.test.ts', 'src/queries/sql/sessions/saveSessionData.test.ts'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'd1',
          environment: 'node',
          include: ['src/db/**/*.test.ts', 'src/queries/sql/sessions/saveSessionData.test.ts'],
        },
      },
    ],
  },
});
