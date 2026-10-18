import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:6006',
    ...devices['Desktop Chrome'],
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:6006/api/health',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_DRIVER: 'pglite',
      PGLITE_PATH: ':memory:',
      JWT_SECRET: 'browser-test-secret-only-for-isolated-memory-database',
      ADMIN_EMAIL: 'browser-admin@example.test',
      ADMIN_PASSWORD: 'browser-password-123',
      VITE_MOCK_MODULES: '',
      MAIL_WORKER: 'off',
      EMAIL_VERIFICATION: 'off',
      OPENAI_API_KEY: '',
      GOOGLE_TTS_API_KEY: '',
      WEB_ORIGIN: 'http://127.0.0.1:6006',
    },
  },
});
