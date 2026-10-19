// Chart audit: for each bot, click every open trade (up to 8) on the Trade page and record the
// preselected strategy, the indicator note, how long the chart took, and errors.
//   PW_CHANNEL=chrome OUT_DIR=/tmp/audit node e2e-live/chart-audit.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, appendFileSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const OUT = (process.env.OUT_DIR ?? '/tmp/audit').replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const BOTS = (process.env.BOTS ?? 'open-cz,open-rwa,lighter-multistrat,aster-multi-strat,bb-revert,donchian-breakout,rsi-zone,orb-mnq-hl,lafo-lighter').split(',');
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
for (const bot of BOTS) {
  const context = await browser.newContext({ viewport: { width: 1900, height: 1150 } });
  const page = await context.newPage();
  let problems = [];
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400 && r.status() !== 503) problems.push(`${r.status()} ${r.url().replace(BASE, '').split('?')[0]}`); });
  page.on('pageerror', (e) => problems.push(`pageerror ${String(e).slice(0, 80)}`));
  await page.addInitScript((id) => localStorage.setItem('ftSelectedBot', id), bot);
  await page.goto(`${BASE}/trade`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  const rows = page.locator('tbody tr');
  const n = Math.min(await rows.count(), 8);
  const line = (s) => { console.log(s); appendFileSync(`${OUT}chart-audit.txt`, s + '\n'); };
  line(`${bot}: ${n} trade rows; strategy dropdown ${await page.locator('[data-testid="chart-strategy-selector"]').count() ? 'present' : 'ABSENT'}`);
  for (let i = 0; i < n; i++) {
    problems = [];
    const rowText = (await rows.nth(i).innerText()).replace(/\s+/g, ' ').slice(0, 60);
    const start = Date.now();
    await rows.nth(i).click();
    let note = '';
    while (Date.now() - start < 30000) {
      note = (await page.locator('[data-testid="overlay-note"]').first().innerText().catch(() => '')).trim();
      if (note) break;
      await page.waitForTimeout(500);
    }
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    const chosen = (await page.locator('[data-testid="chart-strategy-selector"]').first().innerText().catch(() => '(none)')).replace(/\s+/g, ' ').trim();
    line(`  ${rowText.padEnd(60)} | strategy=${chosen.padEnd(28)} | ${secs.padStart(5)}s | ${note || 'NO INDICATORS'} | ${[...new Set(problems)].slice(0, 2).join('; ')}`);
    if (i < 3) await page.screenshot({ path: `${OUT}chart-${bot}-${i}.png` });
  }
  await context.close();
}
await browser.close();
