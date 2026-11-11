import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = 4173;

// A fresh audit log per run, so every run starts from the untouched dataset.
const auditLog = path.join(os.tmpdir(), `sprintfour-e2e-${process.pid}-${Date.now()}`, 'audit.log');

export default defineConfig({
  testDir: './e2e',
  // Tests share one server and its state, so they run in order, in one worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1360, height: 900 },
    // Optional: use an already-installed Chrome instead of Playwright's download.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  // The production build served by the real backend: exactly what `npm start` runs.
  webServer: {
    command: 'npm run build && node ../backend/server.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT), AUDIT_LOG_PATH: auditLog },
  },
});
