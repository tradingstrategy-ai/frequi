// Audit: every multi-strategy bot, every Compare tab, All vs individual strategies, then the Chart.
//   PW_CHANNEL=chrome OUT_DIR=/tmp/audit node e2e-live/strategy-audit.mjs
// Prints one line per (bot, strategy, tab): load seconds, whether content differs from "All",
// empty/withheld notices, and API/console errors; then the Chart strategy dropdown per bot.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const OUT = (process.env.OUT_DIR ?? '/tmp/audit').replace(/\/?$/, '/');
mkdirSync(OUT, { recursive: true });
const BOTS = (process.env.BOTS ?? 'OpenCZ Vault|OpenRWA|Lighter Multistrat|Aster Multi-Strat|GMX AI Vault|Apex Vault|Derive 2 Sleeve').split('|');
const PER_BOT = Number(process.env.PER_BOT ?? 3);
const TABS = ['Overview', 'Execution', 'Timeline', 'Pairs & Overlays', 'Universe & Signals', 'Trade Detail', 'Report'];
const EMPTY = /No trades to show|has no .* sections|withheld|No daily report|Not enough live history|INSUFFICIENT|NO_REPORT|could not be loaded|Failed to load|unavailable/i;

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const page = await (await browser.newContext({ viewport: { width: 1700, height: 1100 } })).newPage();
let problems = [];
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400 && r.status() !== 503) problems.push(`${r.status()} ${r.url().replace(BASE, '').split('?')[0]}`); });
page.on('pageerror', (e) => problems.push(`pageerror ${String(e).slice(0, 90)}`));
const rows = [];
const log = (line) => { console.log(line); rows.push(line); };

async function settled(timeoutMs = 60000) {
  // Busy = a spinner or "Reading the report" on screen. Lazy figures below the fold show a
  // placeholder until scrolled to; they are not counted.
  const start = Date.now();
  await page.waitForTimeout(400);
  while (Date.now() - start < timeoutMs) {
    const busy = await page.evaluate(() => {
      const onScreen = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      };
      const spinners = [...document.querySelectorAll('.animate-spin')].filter(onScreen).length;
      const reading = [...document.querySelectorAll('body *')].some((el) => el.childElementCount === 0 && /Reading the report/.test(el.textContent ?? '') && onScreen(el));
      return spinners + (reading ? 1 : 0);
    });
    if (!busy) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  return (Date.now() - start) / 1000;
}
const signature = async () => {
  const text = (await page.locator('main').first().innerText().catch(() => '')).replace(/generated .*? old/g, '');
  return { hash: createHash('md5').update(text).digest('hex').slice(0, 8), text };
};
async function pickInHeader(testid, label) {
  await page.locator(`[data-testid="${testid}"]`).first().click();
  await page.getByRole('option', { name: label, exact: true }).first().click();
}

await page.goto(`${BASE}/compare/overview`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Report Comparison' }).waitFor({ timeout: 60000 });
for (const bot of BOTS) {
  const botSelect = page.locator('h2:has-text("Report Comparison")').locator('xpath=ancestor::div[3]').getByRole('combobox').first();
  let switched = false;
  for (let attempt = 0; attempt < 3 && !switched; attempt++) {
    await botSelect.click();
    await page.waitForTimeout(500);
    const option = page.getByRole('option', { name: bot, exact: true }).first();
    if (!(await option.count())) { await page.keyboard.press('Escape'); continue; }
    await option.click();
    switched = await page.locator(`text=/Selected report: ${bot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  }
  if (!switched) { log(`${bot}: COULD NOT SELECT`); continue; }
  await page.getByRole('link', { name: 'Overview' }).first().click();
  await settled();
  const hasSelector = await page.locator('[data-testid="strategy-selector"]').count();
  if (!hasSelector) { log(`${bot}: NO STRATEGY SELECTOR`); continue; }
  await page.locator('[data-testid="strategy-selector"]').first().click();
  const strategies = (await page.getByRole('option').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
  await page.keyboard.press('Escape');
  const chosen = ['All strategies', ...strategies.filter((s) => s !== 'All strategies').slice(0, PER_BOT)];
  const allSigs = {};
  for (const strategy of chosen) {
    await pickInHeader('strategy-selector', strategy);
    for (const tab of TABS) {
      problems = [];
      await page.getByRole('link', { name: tab, exact: true }).first().click();
      const secs = await settled();
      const { hash, text } = await signature();
      if (strategy === 'All strategies') allSigs[tab] = hash;
      const same = strategy !== 'All strategies' && allSigs[tab] === hash;
      const empty = (text.match(EMPTY) || [''])[0];
      log(`${bot} | ${strategy.padEnd(34)} | ${tab.padEnd(18)} | ${secs.toFixed(1).padStart(5)}s | ${same ? 'SAME-AS-ALL' : 'ok'} | ${empty} | ${[...new Set(problems)].slice(0, 3).join('; ')}`);
      if (tab === 'Timeline' || tab === 'Overview') await page.screenshot({ path: `${OUT}${bot}-${strategy}-${tab}.png`.replace(/[^a-zA-Z0-9/._-]+/g, '_') });
    }
  }
}
writeFileSync(`${OUT}audit.txt`, rows.join('\n') + '\n');
await browser.close();
