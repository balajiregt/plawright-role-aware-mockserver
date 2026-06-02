import { defineConfig, devices } from '@playwright/test';

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5173';
const mockserverUrl = process.env.MOCKSERVER_URL ?? 'http://127.0.0.1:3333';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],

  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: [
    {
      command: 'npm run start:mockserver',
      url: mockserverUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: 'npm run start:app',
      url: appUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
  ],

  projects: [
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
      },
      metadata: {
        roles: ['admin'],
      },
    },
    {
      name: 'viewer',
      use: {
        ...devices['Desktop Chrome'],
      },
      metadata: {
        roles: ['viewer'],
      },
    },
    {
      name: 'vip',
      use: {
        ...devices['Desktop Chrome'],
      },
      metadata: {
        roles: ['vip'],
      },
    },
  ],
});

