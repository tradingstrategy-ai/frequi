// Asserting end-to-end run over the live dashboard: every bot, every page, every Compare tab and
// strategy, and the Chart for every NT trade. Exits non-zero when any check fails.
//
//   PW_CHANNEL=chrome OUT_DIR=/tmp/run-all node e2e-live/run-all.mjs
//   DASHBOARD_URL=http://100.72.126.50:9198 ... (production, read-only)
//   ONLY=pages,compare,chart,mobile   BOTS=open-cz,bb-revert   WORKERS=3
//
// Writes OUT_DIR/results.json (one row per check) and OUT_DIR/summary.txt; screenshots of
// failures go to OUT_DIR/fail-*.png.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.DASHBOARD_URL ?? 'http://100.72.126.50:9298';
const OUT = (process.env.OUT_DIR ?? '/tmp/run-all').replace(/\/?$/, '/');
const ONLY = new Set((process.env.ONLY ?? 'pages,compare,chart,mobile').split(','));
const WORKERS = Number(process.env.WORKERS ?? 3);
mkdirSync(OUT, { recursive: true });

/** Seconds a page may stay busy (an on-screen spinner) before it counts as stuck. */
const SETTLE_LIMIT_S = 45;
/** Seconds a strategy's chart indicators may take on a cold cache (the chart refreshes itself). */
const OVERLAY_LIMIT_S = 80;
/** Closed trades clicked per NT bot on the Chart, beside every open one. */
const CLOSED_PER_BOT = 3;
/** Pages visited per bot. */
const PAGES = ['/trade', '/graph', '/balance', '/open_trades', '/trade_history', '/pairlist', '/logs'];
/** Compare tabs (route path -> name). */
const TABS = ['overview', 'execution', 'universe', 'timeline', 'pairs', 'trades', 'report'];
/** Compare tabs whose content must change with the strategy for a multi-strategy bot. */
const STRATEGY_TABS = new Set(['overview', 'execution', 'trades']);

const results = [];
function record(area, bot, item, ok, detail = '', seconds = null) {
  results.push({ area, bot, item, ok, detail, seconds });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${area.padEnd(8)} ${bot.padEnd(22)} ${item.padEnd(44)} ${seconds == null ? '' : `${seconds.toFixed(1)}s `}${detail}`);
}

async function api(path, token) {
  const headers = token ? { 'X-Bot-Authorization': `Bearer ${token}` } : {};
  const response = await fetch(BASE + path, { headers, method: path.endsWith('token/login') ? 'POST' : 'GET' });
  return response.ok ? response.json() : null;
}

async function botStatus(slug) {
  const login = await api(`/api/bots/${slug}/api/v1/token/login`);
  if (!login) return [];
  return (await api(`/api/bots/${slug}/api/v1/status`, login.access_token)) ?? [];
}

const normalize = (s) => String(s ?? '').toLowerCase().replace(/-\d+$/, '').replace(/[^a-z0-9]/g, '');

/** Gateway answers that are designed degradation, not defects: a polled read from a slow bot gets
 * a 503 with Retry-After while the gateway keeps fetching it (see the gateway's ``handle``). They
 * are tallied as warnings, so a bot that keeps answering slowly still shows up in the summary. */
const warnings = [];

function watch(page) {
  const seen = [];
  page.on('response', (r) => {
    if (!r.url().includes('/api/') || r.status() < 400) return;
    const line = `${r.status()} ${r.request().method()} ${r.url().replace(BASE, '').split('?')[0]}`;
    if (r.status() === 503 && r.headers()['retry-after']) warnings.push(line);
    else seen.push(line);
  });
  page.on('pageerror', (e) => seen.push(`pageerror ${String(e).slice(0, 120)}`));
  page.on('console', (m) => {
    // The browser logs every non-2xx response; those are judged on the response above.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) seen.push(`console ${m.text().slice(0, 120)}`);
  });
  return {
    take() {
      const out = [...new Set(seen)];
      seen.length = 0;
      return out;
    },
  };
}

async function settle(page, limitS = SETTLE_LIMIT_S) {
  const start = Date.now();
  await page.waitForTimeout(500);
  while ((Date.now() - start) / 1000 < limitS) {
    const busy = await page
      .evaluate(() => {
        const onScreen = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
        };
        // The first visit shows "Dashboard gateway: N of 32 bots connected" while it logs in.
        const connecting = /Dashboard gateway: \d+ of \d+ bots connected/.test(document.body.innerText);
        return [...document.querySelectorAll('.animate-spin')].filter(onScreen).length + (connecting ? 1 : 0);
      })
      .catch(() => 0);
    if (!busy) return { seconds: (Date.now() - start) / 1000, stuck: false };
    await page.waitForTimeout(300);
  }
  return { seconds: (Date.now() - start) / 1000, stuck: true };
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}fail-${name.replace(/[^a-zA-Z0-9._-]+/g, '_')}.png` }).catch(() => {});
}

async function newPage(browser, slug, viewport = { width: 1700, height: 1100 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((id) => localStorage.setItem('ftSelectedBot', id), slug);
  const page = await context.newPage();
  return { context, page, errors: watch(page) };
}

async function pagesForBot(browser, bot) {
  const { context, page, errors } = await newPage(browser, bot.id);
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const { seconds, stuck } = await settle(page);
    const text = (await page.locator('body').innerText().catch(() => '')).trim();
    const problems = errors.take();
    let expectation = '';
    if (path === '/trade' && !/Open Trades/.test(text)) expectation = 'no Open Trades panel';
    if (path === '/graph' && bot.candles && !(await page.locator('canvas').count())) expectation = 'no chart canvas';
    if (text.length < 40) expectation = 'empty page';
    const ok = !stuck && !problems.length && !expectation;
    if (!ok) await shoot(page, `${bot.slug}${path}`);
    record('page', bot.slug, path, ok, [stuck ? 'STUCK' : '', expectation, ...problems].filter(Boolean).join(' | '), seconds);
  }
  await context.close();
}

function contentKey(text, labels) {
  let t = text.replace(/generated .*? ago|\d+ (seconds?|minutes?|hours?) ago/g, '');
  for (const label of labels) t = t.split(label).join('');
  return t.split('\n').filter((line) => !/Selected report|All strategies|Strategy/.test(line)).join('\n');
}

async function compareForBot(browser, cbot) {
  const { context, page, errors } = await newPage(browser, cbot.bot_id);
  const sleeves = cbot.sleeve_info ?? [];
  const labels = sleeves.map((s) => s.label);
  const allKeys = {};
  const choices = [{ id: '', label: 'All strategies' }, ...(sleeves.length > 1 ? sleeves : [])];
  for (const sleeve of choices) {
    for (const tab of TABS) {
      const query = new URLSearchParams({ bot: cbot.bot_id, ...(sleeve.id ? { sleeve: sleeve.id } : {}) });
      await page.goto(`${BASE}/compare/${tab}?${query}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const { seconds, stuck } = await settle(page);
      const main = await page.locator('main').first().innerText().catch(() => '');
      const problems = errors.take();
      const status = cbot.report?.status;
      let expectation = '';
      if (main.trim().length < 30) expectation = 'empty';
      if (status === 'NOT_VALIDATED' && tab === 'overview' && !/NOT VALIDATED|not validated|withheld/i.test(main)) expectation = 'NOT_VALIDATED not shown';
      if (status === 'MISSING' && tab === 'overview' && !/no (daily )?report|missing|not available|No report/i.test(main)) expectation = 'MISSING report not explained';
      const key = contentKey(main, labels);
      if (!sleeve.id) allKeys[tab] = key;
      else if (STRATEGY_TABS.has(tab) && status === 'SUCCESS' && allKeys[tab] === key) expectation = 'same content as All strategies';
      const ok = !stuck && !problems.length && !expectation;
      const item = `${tab} · ${sleeve.label}`.slice(0, 44);
      if (!ok) await shoot(page, `cmp-${cbot.bot_id}-${tab}-${sleeve.id || 'all'}`);
      record('compare', cbot.bot_id, item, ok, [stuck ? 'STUCK' : '', expectation, ...problems].filter(Boolean).join(' | '), seconds);
    }
  }
  await context.close();
}

async function chartForBot(browser, bot, sleeves) {
  const { context, page, errors } = await newPage(browser, bot.id);
  await page.goto(BASE + '/trade', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const open = await botStatus(bot.slug);
  const rows = page.locator('tbody tr').filter({ hasText: /\d{6,} \|/ });
  const count = await rows.count();
  const texts = [];
  for (let i = 0; i < count; i++) texts.push(await rows.nth(i).innerText());
  const ids = texts.map((t) => t.match(/(\d{6,}) \|/)?.[1]).filter(Boolean);
  const openIds = new Set(open.map((t) => String(t.trade_id)));
  const picks = [...ids.filter((id) => openIds.has(id)), ...ids.filter((id) => !openIds.has(id)).slice(0, CLOSED_PER_BOT)];
  if (!picks.length) record('chart', bot.slug, 'any trade to click', true, 'no trades listed');
  errors.take();
  for (const id of picks) {
    const trade = open.find((t) => String(t.trade_id) === id);
    await page.locator('tbody tr').filter({ hasText: `${id} |` }).first().click();
    const start = Date.now();
    let note = '';
    while ((Date.now() - start) / 1000 < OVERLAY_LIMIT_S) {
      note = (await page.locator('[data-testid="overlay-note"]').first().innerText().catch(() => '')).trim();
      if (/config|recorded live/.test(note)) break;
      await page.waitForTimeout(1000);
    }
    const seconds = (Date.now() - start) / 1000;
    const chosen = (await page.locator('[data-testid="chart-strategy-selector"]').first().innerText().catch(() => '')).trim();
    let expectation = '';
    if (!/config|recorded live/.test(note)) expectation = `no indicators (${note || 'no note'})`;
    if (/defaults/.test(note)) expectation = `default parameters (${note})`;
    if (trade && sleeves.length > 1) {
      const sleeve = sleeves.find((s) => s.match.some((m) => normalize(trade.strategy) === m || normalize(trade.strategy).startsWith(m)));
      if (sleeve && chosen && !chosen.includes(sleeve.label)) expectation += ` strategy preselected "${chosen}" for a ${trade.strategy} trade`;
    }
    if (!(await page.locator('canvas').count())) expectation += ' no chart canvas';
    const problems = errors.take();
    const ok = !expectation && !problems.length;
    if (!ok) await shoot(page, `chart-${bot.slug}-${id}`);
    record('chart', bot.slug, `${trade ? 'open' : 'closed'} ${id}`, ok, [expectation.trim(), note && ok ? note : '', ...problems].filter(Boolean).join(' | '), seconds);
  }
  await context.close();
}

async function mobile(browser, bots) {
  for (const slug of bots) {
    const { context, page, errors } = await newPage(browser, slug, { width: 390, height: 844 });
    for (const path of ['/trade', '/graph', `/compare/overview?bot=${slug}`]) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const { seconds, stuck } = await settle(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const problems = errors.take();
      const ok = !stuck && !problems.length && overflow <= 4;
      if (!ok) await shoot(page, `mobile-${slug}${path}`);
      record('mobile', slug, path, ok, [stuck ? 'STUCK' : '', overflow > 4 ? `page ${overflow}px wider than the screen` : '', ...problems].filter(Boolean).join(' | '), seconds);
    }
    await context.close();
  }
}

async function pool(items, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (queue.length) await worker(queue.shift());
  }));
}

const registry = (await api('/api/bots/_registry')) ?? {};
// FreqUI names a bot by its comparison id when it has one (orchestrator_gmx_ai_gmx_vault), else by slug.
let bots = (registry.bots ?? registry).map((b) => ({ slug: b.slug, id: b.comparison_id || b.slug, engine: b.engine, name: b.display_name, candles: b.slug !== 'derive' }));
const comparison = ((await api('/api/comparison/bots')) ?? {}).bots ?? [];
if (process.env.BOTS) {
  const only = new Set(process.env.BOTS.split(','));
  bots = bots.filter((b) => only.has(b.slug));
}
console.log(`${bots.length} bots, ${comparison.length} comparison entries, ${BASE}`);
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const started = Date.now();
if (ONLY.has('pages')) {
  await pool(bots, (bot) => pagesForBot(browser, bot));
  const { context, page, errors } = await newPage(browser, bots[0]?.id ?? '');
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const { seconds, stuck } = await settle(page, 90);
  const problems = errors.take();
  record('page', '(all bots)', '/dashboard', !stuck && !problems.length, [stuck ? 'STUCK' : '', ...problems].join(' | '), seconds);
  await context.close();
}
if (ONLY.has('compare')) {
  const wanted = new Set(bots.map((b) => b.slug));
  await pool(comparison.filter((c) => !process.env.BOTS || wanted.has(c.bot_id)), (c) => compareForBot(browser, c));
}
if (ONLY.has('chart')) {
  const sleevesOf = Object.fromEntries(comparison.map((c) => [c.bot_id, c.sleeve_info ?? []]));
  await pool(bots.filter((b) => b.engine === 'NT' && b.candles), (b) => chartForBot(browser, b, sleevesOf[b.slug] ?? []));
}
if (ONLY.has('mobile')) await mobile(browser, bots.filter((b) => ['open-cz', 'aster-multi-strat', 'ichiv2-hl-live', 'gmx'].includes(b.slug)).map((b) => b.id));
await browser.close();

const failed = results.filter((r) => !r.ok);
const summary = [
  `${BASE} — ${results.length} checks, ${failed.length} failed, ${((Date.now() - started) / 60000).toFixed(1)} min`,
  ...Object.entries(results.reduce((acc, r) => ({ ...acc, [r.area]: [(acc[r.area]?.[0] ?? 0) + 1, (acc[r.area]?.[1] ?? 0) + (r.ok ? 0 : 1)] }), {})).map(([area, [n, f]]) => `  ${area}: ${n - f}/${n} pass`),
  ...failed.map((r) => `  FAIL ${r.area} ${r.bot} ${r.item}: ${r.detail}`),
  `  slow-bot 503 warnings: ${warnings.length}`,
  ...Object.entries(warnings.reduce((acc, w) => ({ ...acc, [w]: (acc[w] ?? 0) + 1 }), {})).map(([w, n]) => `    ${n}x ${w}`),
];
writeFileSync(`${OUT}results.json`, JSON.stringify(results, null, 1));
writeFileSync(`${OUT}summary.txt`, summary.join('\n') + '\n');
console.log(summary.join('\n'));
process.exit(failed.length ? 1 : 0);
