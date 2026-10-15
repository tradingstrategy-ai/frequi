// Run on vitalik8 (not a laptop): docker run --rm --network host -v $PWD:/w -w /w \
//   mcr.microsoft.com/playwright:v1.60.0-noble node e2e-live/explore-sections.mjs [bot,bot,...]
// Click through every Compare tab for a few bots; scroll to draw every report chart.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const OUT = (process.env.OUT_DIR ?? new URL('./out/', import.meta.url).pathname) + 'sections/';
mkdirSync(OUT, { recursive: true });
const bots = (process.argv[2] ?? 'bb-revert,dipbuyer_apex_standalone,open-cz,ichiv3-hl-live,orchestrator_gmx_ai_gmx_vault').split(',');
const TABS = ['Overview', 'Execution', 'Timeline', 'Pairs & Overlays', 'Universe & Signals', 'Trade Detail', 'Report'];
const PATHS = { Overview: 'overview', Execution: 'execution', Timeline: 'timeline', 'Pairs & Overlays': 'pairs', 'Universe & Signals': 'universe', 'Trade Detail': 'trades', Report: 'report' };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebSocket/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
page.on('requestfailed', (r) => errors.push(`failed: ${r.failure()?.errorText} ${r.url().replace(BASE, '')}`));
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
await page.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
});
const log = [];
const note = (s) => { log.push(s); console.log(s); };
for (const bot of bots) {
  note(`\n## ${bot}`);
  await page.goto(`${BASE}/compare/overview?bot=${bot}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  for (const tab of TABS) {
    const t0 = Date.now();
    let navigated = false;
    for (let attempt = 0; attempt < 3 && !navigated; attempt += 1) {
      await page.getByRole('link', { name: tab, exact: true }).first().click();
      navigated = await page.waitForURL(new RegExp(`/compare/${PATHS[tab]}\\b`), { timeout: 5000 }).then(() => true, () => false);
    }
    if (!navigated) note(`  ${tab}: CLICK DID NOT NAVIGATE`);
    if (tab !== 'Report') {
      await page.locator(`[data-testid="report-sections"][data-tab="${PATHS[tab]}"]`).first().waitFor({ timeout: 60_000 }).catch(() => note(`  ${tab}: sections never rendered`));
      await page.waitForFunction(() => {
        const s = document.querySelector('[data-testid="report-sections"]');
        return s && !s.textContent.includes('Reading the report');
      }, null, { timeout: 60_000 }).catch(() => {});
    } else {
      await page.waitForTimeout(3000);
    }
    const shown = Date.now() - t0;
    // FreqUI scrolls an inner container: grow the viewport to the content so every
    // figure intersects (and the screenshot shows the whole tab).
    const contentHeight = await page.evaluate(() => {
      const scroller = [...document.querySelectorAll('*')].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 20 && e.querySelector('[data-testid="report-sections"], [data-testid="report-frame"]'));
      return scroller ? scroller.scrollHeight + 200 : document.body.scrollHeight;
    });
    await page.setViewportSize({ width: 1600, height: Math.min(Math.max(contentHeight, 1000), 30000) });
    await page.waitForTimeout(500);
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="report-figure"]')].some((f) => ['idle', 'loading'].includes(f.dataset.state) && f.querySelector('.animate-spin')), null, { timeout: 90_000 }).catch(() => {});
    const stats = await page.evaluate(() => {
      const figs = [...document.querySelectorAll('[data-testid="report-figure"]')];
      const by = {}; figs.forEach((f) => { by[f.dataset.state] = (by[f.dataset.state] ?? 0) + 1; });
      const lt = window.__lt; window.__lt = [];
      return {
        figs: by, chunks: document.querySelectorAll('[data-testid^="report-chunk-"]').length,
        tables: document.querySelectorAll('[data-testid="report-sections"] table').length,
        details: document.querySelectorAll('[data-testid="report-details"]').length,
        ranker: document.querySelectorAll('[data-testid="ranker-admission"]').length,
        empty: document.querySelector('[data-testid="report-sections-empty"]')?.textContent?.trim()?.slice(0, 80) ?? '',
        alert: [...document.querySelectorAll('[data-testid="report-sections"] [role="alert"], [data-testid="report-withheld"]')].map((a) => a.textContent.trim().slice(0, 90)).join(' | '),
        frame: document.querySelectorAll('[data-testid="report-frame"]').length,
        longest: Math.max(0, ...lt), longTotal: lt.reduce((a, b) => a + b, 0),
      };
    });
    note(`  ${tab.padEnd(19)} shown ${String(shown).padStart(5)}ms chunks=${stats.chunks} tables=${stats.tables} details=${stats.details} ranker=${stats.ranker} figs=${JSON.stringify(stats.figs)} frame=${stats.frame} longtask max=${stats.longest} total=${stats.longTotal} ${stats.empty} ${stats.alert}`);
    if (errors.length) { note(`    ERRORS: ${[...new Set(errors)].slice(0, 5).join(' || ')}`); errors.length = 0; }
    await page.screenshot({ path: `${OUT}${bot}-${tab.replace(/\W+/g, '_')}.jpg`, fullPage: true, quality: 45, type: 'jpeg' });
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
}
writeFileSync(`${OUT}log.txt`, log.join('\n'));
await browser.close();
