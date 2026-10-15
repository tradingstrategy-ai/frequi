// Use the dashboard the way a person does: open it, then CLICK the navbar links.
//   CPU_THROTTLE=4 node e2e-live/explore-clicks.mjs
// Records, per click: did the URL/content change, how long until it did, and how long
// the browser's main thread was blocked (long tasks), plus any JS errors.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const THROTTLE = Number(process.env.CPU_THROTTLE ?? 1);
const OUT = new URL('./explore-clicks/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (...a) => { const l = a.join(' '); log.push(l); console.log(l); };

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
let requests = 0;
page.on('request', (r) => { if (r.url().includes('/api/')) requests += 1; });

if (THROTTLE > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  note(`# CPU throttled ${THROTTLE}x`);
}
await page.addInitScript(() => {
  window.__longTasks = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
  }).observe({ entryTypes: ['longtask'] });
});

async function blocked() {
  const tasks = await page.evaluate(() => { const t = window.__longTasks; window.__longTasks = []; return t; });
  return { count: tasks.length, worst: Math.max(0, ...tasks), total: tasks.reduce((a, b) => a + b, 0) };
}

note('# cold open /');
let t0 = Date.now();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.getByRole('link', { name: 'Dashboard', exact: true }).first().waitFor({ timeout: 60_000 });
note(`  navbar visible after ${Date.now() - t0} ms`, JSON.stringify(await blocked()));
await page.waitForTimeout(8000);
note('  after 8 s idle:', JSON.stringify(await blocked()), `api requests so far: ${requests}`);
await page.screenshot({ path: OUT + '00-open.png' });

for (const label of ['Dashboard', 'Chart', 'Compare', 'Reports', 'Trade', 'Logs', 'Dashboard']) {
  note(`\n# click "${label}"`);
  const before = page.url();
  t0 = Date.now();
  await page.getByRole('link', { name: label, exact: true }).first().click({ timeout: 30_000 }).catch((e) => note('  CLICK FAILED:', String(e).split('\n')[0]));
  let changed = false;
  for (let i = 0; i < 60 && !changed; i += 1) {
    await page.waitForTimeout(250);
    changed = page.url() !== before;
  }
  const urlMs = Date.now() - t0;
  await page.waitForTimeout(3500);
  const text = (await page.locator('#app').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  note(`  url ${changed ? 'changed' : 'DID NOT CHANGE'} in ${urlMs} ms -> ${page.url().replace(BASE, '')}`);
  note('  main thread blocked:', JSON.stringify(await blocked()), `| content ${text.length} chars | api requests: ${requests}`);
  if (errors.length) { note('  ERRORS:', [...new Set(errors)].slice(0, 4).join(' || ')); errors.length = 0; }
  await page.screenshot({ path: OUT + `${label.replace(/\W/g, '')}-${log.length}.png` });
}
writeFileSync(OUT + 'log.txt', log.join('\n'));
await browser.close();
