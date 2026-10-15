// Click through the Compare section with the page's own bot selector.
//   node e2e-live/explore-compare.mjs "BB Revert" "OpenCZ Vault" ...
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const OUT = new URL('./explore-compare/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['BB Revert', 'OpenCZ Vault', 'IchiV3 LS Hyperliquid Live', 'GMX AI Vault', 'Lighter Multistrat'];

const log = [];
const note = (...a) => {
  const line = a.join(' ');
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await context.newPage();
const failures = [];
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) failures.push(`${r.status()} ${r.url().replace(BASE, '')}`);
});
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/.test(m.text())) failures.push(`console: ${m.text().slice(0, 160)}`);
});

let n = 0;
async function shot(name) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}-${name.replace(/[^a-z0-9-]+/gi, '_')}.png`;
  await page.screenshot({ path: OUT + file, fullPage: true });
  const f = [...new Set(failures)];
  failures.length = 0;
  note(`  [shot] ${file}${f.length ? `  FAILURES: ${f.join(' | ')}` : ''}`);
}

/** Text of the whole Compare content area, to count N/A cells and spot empty states. */
async function contentText() {
  return (await page.locator('#app').first().innerText()).replace(/\s+/g, ' ');
}

async function compareSelect() {
  // The select inside the Compare header, not the navbar's bot picker.
  return page.locator('h2:has-text("Report Comparison")').locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('combobox').first();
}

note('# fresh visit /compare/overview');
await page.goto(BASE + '/compare/overview');
await page.waitForTimeout(9000);
await shot('compare-default');
const header = (await page.locator('h2:has-text("Report Comparison") + p').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
note('  default selection:', header);

const select = await compareSelect();
await select.click();
await page.waitForTimeout(800);
const options = await page.getByRole('option').allInnerTexts();
note(`  compare selector options (${options.length}): ${options.join(' | ')}`);
await shot('compare-selector-open');
await page.keyboard.press('Escape');

for (const target of targets) {
  note(`\n# select "${target}" in the Compare selector`);
  await (await compareSelect()).click();
  await page.waitForTimeout(500);
  const opt = page.getByRole('option', { name: target, exact: true }).first();
  if (!(await opt.count())) {
    note('  OPTION NOT FOUND');
    await page.keyboard.press('Escape');
    continue;
  }
  await opt.click();
  await page.waitForTimeout(5000);
  for (const tab of ['Overview', 'Timeline', 'Pairs', 'Deep Dive', 'Report']) {
    await page.getByRole('link', { name: tab, exact: true }).first().click();
    await page.waitForTimeout(tab === 'Report' ? 7000 : 4500);
    const text = await contentText();
    const na = (text.match(/\bN\/A\b/g) ?? []).length;
    const empties = ['No equity curve data', 'No daily profit', 'No pair data', 'No trades to show', 'Unavailable report fields', 'No full report', 'Could not load'].filter((t) => text.includes(t));
    const tables = await page.locator('table').count();
    const charts = await page.locator('canvas').count();
    const frame = await page.getByTestId('report-frame').count();
    const banner = (await page.getByTestId('report-status-notice').count()) ? 'STATUS-BANNER' : '';
    note(`  ${tab.padEnd(9)} N/A=${na} tables=${tables} charts=${charts} frames=${frame} ${banner} ${empties.length ? 'EMPTY: ' + empties.join(', ') : ''}`);
    await shot(`${target}-${tab}`);
  }
}

writeFileSync(OUT + 'log.txt', log.join('\n'));
await browser.close();
