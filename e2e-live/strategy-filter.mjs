// Per-strategy filtering on the live staging dashboard (open-cz has ~9 strategies).
//   OUT_DIR=/tmp/sf PW_CHANNEL=chrome node strategy-filter.mjs [bot] [pair]
// Compare: the Strategy dropdown narrows the Timeline cards and the report sections.
// Chart: the Strategy dropdown narrows fills/indicators; clicking an open trade preselects its strategy.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const [bot = 'open-cz', pairQuery = 'NEAR', BOT_LABEL = 'OpenCZ Vault'] = process.argv.slice(2);
const OUT = (process.env.OUT_DIR ?? new URL('./out/', import.meta.url).pathname).replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const launch = process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {};
const browser = await chromium.launch(launch);
const page = await (await browser.newContext({ viewport: { width: 1700, height: 1100 } })).newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400 && r.status() !== 503) problems.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 120)}`);
});
const say = (...a) => console.log(...a);
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });

/** Pick an item of the Nuxt UI select that carries `testid`. */
async function pick(testid, label) {
  await page.locator(`[data-testid="${testid}"]`).first().click();
  await page.getByRole('option', { name: label }).first().click();
  await page.waitForTimeout(2500);
}

// ---- Compare -------------------------------------------------------------------------
await page.goto(`${BASE}/compare/timeline`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Report Comparison' }).waitFor({ timeout: 60000 });
await page.waitForTimeout(3000);
// The page's own bot selector (the first select under the heading; the navbar has its own).
await page.locator('h2:has-text("Report Comparison")').locator('xpath=ancestor::div[3]').getByRole('combobox').first().click();
await page.getByRole('option', { name: BOT_LABEL }).first().click();
await page.waitForSelector('[data-testid="strategy-selector"]', { timeout: 60000 });
await page.waitForTimeout(4000);
const cards = async () => (await page.locator('text=/Matched|Live only|Backtest only|Match rate/').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
say('compare ALL    ', await cards());
await shot('compare-all');
for (const label of ['Donchian Long', 'IchiV4 Short', 'BB Revert LS']) {
  await pick('strategy-selector', label);
  say(`compare ${label.padEnd(14)}`, page.url().replace(BASE, ''), '|', await cards());
  const header = await page.locator('text=/SUCCESS|INSUFFICIENT|NO_BACKTEST|generated/').first().innerText().catch(() => '');
  say('   header:', header.replace(/\s+/g, ' ').slice(0, 220));
  await shot(`compare-${label.replace(/\s+/g, '_')}`);
}
// The report sections (Execution tab) follow the same dropdown.
await page.getByRole('link', { name: 'Execution' }).first().click();
await page.waitForTimeout(5000);
say('execution     ', page.url().replace(BASE, ''), 'selector-in-section visible:', await page.locator('[data-testid="report-selector"]').count());
await shot('compare-execution-bb-revert');

// ---- Chart ---------------------------------------------------------------------------
await page.addInitScript((id) => localStorage.setItem('ftSelectedBot', id), bot);
await page.goto(`${BASE}/graph`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await page.getByText('Show BT vs live fills').click();
await page.locator('[class*="md:w-80"]').first().click();
await page.keyboard.type(pairQuery);
await page.waitForTimeout(800);
await page.getByRole('option').filter({ hasText: pairQuery }).first().click();
await page.keyboard.press('Escape');
await page.waitForTimeout(7000);
say('chart selector visible:', await page.locator('[data-testid="chart-strategy-selector"]').count());
await shot('chart-all');
const options = await page.locator('[data-testid="chart-strategy-selector"]').first().click().then(async () => {
  const names = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  return names;
});
say('chart strategies:', JSON.stringify(options));
for (const label of options.filter((o) => o !== 'All strategies').slice(0, 2)) {
  await pick('chart-strategy-selector', label);
  await page.waitForTimeout(3000);
  await shot(`chart-${label.replace(/\s+/g, '_')}`);
  say('chart', label, 'ok');
}

// ---- Trade click preselects the strategy ----------------------------------------------
await page.goto(`${BASE}/trade`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const rows = page.locator('tbody tr');
say('trade rows:', await rows.count());
if (await rows.count()) {
  await rows.first().click();
  await page.waitForTimeout(6000);
  const chosen = await page.locator('[data-testid="chart-strategy-selector"]').first().innerText().catch(() => '(no selector)');
  say('after clicking a trade, chart strategy =', chosen.replace(/\s+/g, ' '));
  await shot('trade-click');
}
say('problems:', JSON.stringify([...new Set(problems)].slice(0, 8)));
await browser.close();
