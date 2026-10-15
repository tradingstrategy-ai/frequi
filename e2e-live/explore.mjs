// Exploratory click-through of the live dashboard, like an operator would do it.
//   node e2e-live/explore.mjs [slug-or-display-name ...]
// Screenshots + a log of what each step showed go to e2e-live/explore/.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const OUT = new URL('./explore/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['OpenCZ Vault', 'GMX AI Vault'];

const log = [];
const note = (...a) => {
  const line = a.join(' ');
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const failures = [];
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) failures.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`);
});
page.on('console', (m) => {
  if (m.type() === 'error') failures.push(`console: ${m.text().slice(0, 200)}`);
});
let n = 0;
async function shot(name) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}-${name.replace(/[^a-z0-9-]+/gi, '_')}.png`;
  await page.screenshot({ path: OUT + file, fullPage: false });
  note(`  [shot] ${file}${failures.length ? `  failures: ${[...new Set(failures)].join(' | ')}` : ''}`);
  failures.length = 0;
}

note('# fresh visit /');
await page.goto(BASE + '/');
await page.waitForTimeout(8000);
await shot('home');

note('# navbar bot picker');
const picker = page.locator('header, nav').getByRole('combobox').first();
await picker.click().catch((e) => note('  picker click failed', e.message));
await page.waitForTimeout(800);
const options = await page.getByRole('option').allInnerTexts();
note(`  picker options (${options.length}): ${options.join(' | ')}`);
await shot('picker-open');
await page.keyboard.press('Escape');

for (const target of targets) {
  note(`\n# select bot "${target}" from the navbar picker`);
  await picker.click();
  await page.waitForTimeout(500);
  const opt = page.getByRole('option', { name: target }).first();
  if (await opt.count()) {
    await opt.click();
  } else {
    note('  option not found');
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(1500);

  note('## /trade');
  await page.goto(BASE + '/trade');
  await page.waitForTimeout(9000);
  await shot(`${target}-trade`);
  const tabs = page.locator('[role="tablist"] [role="tab"]');
  const tabCount = await tabs.count();
  note(`  left-pane tabs: ${tabCount}`);
  for (let i = 0; i < tabCount; i++) {
    const title = (await tabs.nth(i).getAttribute('title')) ?? (await tabs.nth(i).innerText());
    await tabs.nth(i).click();
    await page.waitForTimeout(2500);
    const paneText = (await page.locator('[role="tabpanel"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 220);
    note(`  tab ${i} "${title}": ${paneText}`);
    await shot(`${target}-trade-tab${i}`);
  }

  for (const path of ['/dashboard', '/graph', '/logs', '/balance', '/trade_history', '/open_trades', '/pairlist']) {
    note(`## ${path}`);
    await page.goto(BASE + path);
    await page.waitForTimeout(6000);
    const text = (await page.locator('main, #app').first().innerText()).replace(/\s+/g, ' ').slice(0, 300);
    note(`  text: ${text}`);
    await shot(`${target}-${path.slice(1)}`);
  }
}

note('\n# /compare');
await page.goto(BASE + '/compare/overview');
await page.waitForTimeout(6000);
await shot('compare');
const compareSelect = page.locator('main, #app').getByRole('combobox').first();
await compareSelect.click().catch((e) => note('  compare select click failed', e.message));
await page.waitForTimeout(800);
note(`  compare options: ${(await page.getByRole('option').allInnerTexts()).join(' | ')}`);
await shot('compare-select-open');
await page.keyboard.press('Escape');

note('\n# /reports');
await page.goto(BASE + '/reports');
await page.waitForTimeout(6000);
await shot('reports');

writeFileSync(OUT + 'log.txt', log.join('\n'));
await browser.close();
