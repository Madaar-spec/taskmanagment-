import { defineConfig, devices } from '@playwright/test';

// اختبارات القبول AC-01 إلى AC-15 على بيانات Seed بتاريخ مثبّت 2026-10-15 (القسم 9)
export const E2E_DB =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/madaar_e2e?schema=public';
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: E2E_DB,
      DIRECT_URL: E2E_DB,
      APP_FIXED_TODAY: '2026-10-15',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-0123456789',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: './storage-e2e',
    },
  },
});
