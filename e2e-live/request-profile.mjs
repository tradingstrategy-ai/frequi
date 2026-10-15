// Where do the browser's API requests come from? Counts them by endpoint and by phase.
//   node e2e-live/request-profile.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
let counts = {};
page.on('request', (r) => {
  const m = r.url().match(/\/api\/bots\/([^/]+)\/api\/v1\/([^/?]+)/);
  const key = m ? m[2] : r.url().includes('/api/comparison') ? 'comparison' : r.url().includes('/api/reports') ? 'reports' : 'other';
  counts[key] = (counts[key] ?? 0) + 1;
});
const report = (label) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => `${k}=${v}`).join('  ');
  console.log(`${label.padEnd(34)} total=${String(total).padStart(5)}  ${top}`);
  counts = {};
};

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(15_000);
report('first 15 s after opening /');
await page.waitForTimeout(15_000);
report('next 15 s, idle on that page');
await page.getByRole('link', { name: 'Dashboard', exact: true }).first().click();
await page.waitForTimeout(10_000);
report('10 s after clicking Dashboard');
await page.waitForTimeout(15_000);
report('next 15 s idle on Dashboard');
await page.getByRole('link', { name: 'Trade', exact: true }).first().click();
await page.waitForTimeout(10_000);
report('10 s after clicking Trade');
await page.waitForTimeout(15_000);
report('next 15 s idle on Trade');
await browser.close();
