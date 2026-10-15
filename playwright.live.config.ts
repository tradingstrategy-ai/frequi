import { defineConfig } from '@playwright/test';

/**
 * End-to-end run against a real dashboard (the vitalik8 staging stack behind the bot
 * gateway), not the mocked `e2e/` suite.
 *
 *   DASHBOARD_URL=http://100.72.126.50:9298 DASHBOARD_USER=dashboard DASHBOARD_PASSWORD=... \
 *     pnpm exec playwright test -c playwright.live.config.ts
 *
 * Read-only by design: the gateway refuses writes, and the spec never clicks a control.
 * Screenshots and a summary land in `e2e-live/results/` (git-ignored).
 */
export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60 * 60 * 1000,
  reporter: [['list']],
  outputDir: './e2e-live/results/playwright',
  use: {
    baseURL: process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298',
    httpCredentials: {
      username: process.env.DASHBOARD_USER ?? 'dashboard',
      password: process.env.DASHBOARD_PASSWORD ?? '',
    },
    channel: 'chrome',
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
  },
});
