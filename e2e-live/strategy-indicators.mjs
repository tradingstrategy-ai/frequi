// The selected strategy's own indicators on the Chart: open a trade, then switch strategy.
//   PW_CHANNEL=chrome OUT_DIR=/tmp/si node e2e-live/strategy-indicators.mjs [bot] [tradePair] [otherStrategyLabel]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const [bot = 'open-cz', tradePair = 'NEAR', other = 'Donchian Long'] = process.argv.slice(2);
const OUT = (process.env.OUT_DIR ?? new URL('./out/', import.meta.url).pathname).replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await (await browser.newContext({ viewport: { width: 2000, height: 1150 } })).newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(String(e).slice(0, 160)));
const note = async () => (await page.locator('[data-testid="overlay-note"]').first().innerText().catch(() => '(none)')).trim();
const selected = async () => (await page.locator('[data-testid="chart-strategy-selector"]').first().innerText().catch(() => '(none)')).replace(/\s+/g, ' ').trim();

await page.addInitScript((id) => localStorage.setItem('ftSelectedBot', id), bot);
await page.goto(`${BASE}/trade`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await page.locator('tbody tr', { hasText: tradePair }).first().click();
await page.waitForTimeout(20000);
console.log(`after opening the ${tradePair} trade: strategy=${await selected()} | note=${await note()}`);
await page.screenshot({ path: `${OUT}${bot}-${tradePair}-trade.png` });

await page.locator('[data-testid="chart-strategy-selector"]').first().click();
await page.getByRole('option', { name: other }).first().click();
await page.waitForTimeout(20000);
console.log(`after choosing ${other}: strategy=${await selected()} | note=${await note()}`);
await page.screenshot({ path: `${OUT}${bot}-${tradePair}-${other.replace(/\s+/g, '_')}.png` });
console.log('problems:', JSON.stringify([...new Set(problems)].slice(0, 5)));
await browser.close();
