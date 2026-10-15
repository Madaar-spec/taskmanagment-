import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // اختبارات التكامل تتشارك قاعدة بيانات الاختبار
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/server/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['src/server/storage/**', 'src/server/db.ts'],
      thresholds: { 'src/server/services/**': { lines: 80, functions: 80, statements: 80 } },
      reporter: ['text-summary', 'text'],
    },
  },
});
