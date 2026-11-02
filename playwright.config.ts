import { defineConfig, devices } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const base: string = require('./scripts/base-path.cjs')();
const url = `http://localhost:4173${base}`;

// Web E2E (README §7.1) against the exported build, served under the GitHub Pages base path.
// Build first: npm run build:web
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: url,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs 4173',
    url: url,
    reuseExistingServer: !process.env.CI,
  },
});
