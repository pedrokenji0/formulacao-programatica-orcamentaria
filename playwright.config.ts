import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    baseURL: 'http://127.0.0.1:4173/formulacao-programatica-orcamentaria/',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview:local',
    url: 'http://127.0.0.1:4173/formulacao-programatica-orcamentaria/',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
