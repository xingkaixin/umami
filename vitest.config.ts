import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const d1Tests = ['src/db/**/*.test.ts', 'src/queries/sql/sessions/saveSessionData.test.ts'];
const domTests = [
  'src/**/*.test.tsx',
  'src/components/**/*.test.ts',
  'src/store/dashboard.test.ts',
];

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
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, '**/pnpm-lock.yaml'],
    experimental: {
      recordDependencies: true,
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...d1Tests, ...domTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: domTests,
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'd1',
          environment: 'node',
          include: d1Tests,
        },
      },
    ],
  },
});
