import { defineConfig, devices } from '@playwright/test';

const testPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const testOrigin = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: testOrigin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run db:migrate:local && npm run dev -- --host 127.0.0.1 --port ${testPort}`,
    url: testOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      ENVIRONMENT: 'local',
      BUILDER_ORIGIN: testOrigin,
      SESSION_SECRET: 'playwright-session-secret-at-least-thirty-two-characters',
    },
  },
});
