import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
const repeats = Number(process.env.BENCHMARK_REPEATS ?? 3);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 50) throw new Error('BENCHMARK_REPEATS must be an integer from 1 to 50');
export default defineConfig({
  testDir: '.', testMatch: 'roles.spec.ts', workers: 1, retries: 0,
  repeatEach: repeats,
  outputDir: '../benchmark-results/traces',
  reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../benchmark-results/playwright.json', import.meta.url)) }]],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5273', trace: 'retain-on-failure' },
  webServer: [
    { cwd: fileURLToPath(new URL('../', import.meta.url)), command: 'MOCKSERVER_PORT=3433 node mockserver/src/mock-server.js', url: 'http://127.0.0.1:3433', reuseExistingServer: false },
    { cwd: fileURLToPath(new URL('../', import.meta.url)), command: 'APP_PORT=5273 MOCKSERVER_URL=http://127.0.0.1:3433 node app/server.mjs', url: 'http://127.0.0.1:5273', reuseExistingServer: false }
  ]
});
