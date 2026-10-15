import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Walk every bot in the dashboard registry through every FreqUI page it supports, on
 * the real staging dashboard, and record what an operator would see.
 *
 * Per bot: Trade view (open trades, candle chart, controls), Graph view, the fleet
 * live-vs-backtest report, and the native comparison when the bot has one. Each page
 * records failed API calls (HTTP >= 400 on /api/), console errors, whether a chart
 * canvas rendered, and a screenshot. Nothing is clicked that could write to a bot.
 */

interface RegistryBot {
  slug: string;
  display_name: string;
  engine: 'FT' | 'NT';
  api_route: string;
  comparison_id: string | null;
  has_reports: boolean;
  read_only: boolean;
  connected: boolean;
}

interface PageResult {
  page: string;
  url: string;
  screenshot: string;
  apiFailures: string[];
  consoleErrors: string[];
  charts: number;
  notes: string[];
}

const RESULTS_DIR = join(import.meta.dirname, 'results');
const SHOTS_DIR = join(RESULTS_DIR, 'screenshots');

/** Console noise that is not a dashboard defect. */
const IGNORED_CONSOLE = [/favicon/i, /Download the Vue Devtools/i, /\[intlify\]/i];

const results: Record<string, PageResult[]> = {};
let context: BrowserContext;
let page: Page;
let bots: RegistryBot[] = [];
let apiFailures: string[] = [];
let consoleErrors: string[] = [];

function botId(bot: RegistryBot): string {
  return bot.comparison_id ?? bot.slug;
}

/**
 * Let a page load its data. FreqUI polls every few seconds, so "network idle" rarely
 * happens; wait for the DOM, then a fixed beat for the first refresh to land.
 */
async function settle(target: Page, ms = 2500): Promise<void> {
  await target.waitForLoadState('domcontentloaded');
  await target.waitForTimeout(ms);
}

/**
 * Wait (bounded) for the candle chart. FreqUI shows "No data available" while candles
 * are still loading, so that text only counts once no chart appeared in time.
 */
async function waitForChart(target: Page): Promise<string> {
  const drawn = await target
    .locator('canvas')
    .first()
    .waitFor({ timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  if (drawn) return 'chart';
  return (await target.getByText(/No data available|No pair selected/).count()) > 0 ? 'no data' : 'timeout';
}

async function capture(slug: string, name: string, notes: string[] = []): Promise<PageResult> {
  mkdirSync(join(SHOTS_DIR, slug), { recursive: true });
  const screenshot = join('screenshots', slug, `${name}.png`);
  await page.screenshot({ path: join(RESULTS_DIR, screenshot), fullPage: true });
  const charts = await page.locator('canvas').count();
  const result: PageResult = {
    page: name,
    url: page.url().replace(/^https?:\/\/[^/]+/, ''),
    screenshot,
    apiFailures: [...new Set(apiFailures)],
    consoleErrors: [...new Set(consoleErrors)],
    charts,
    notes,
  };
  (results[slug] ??= []).push(result);
  apiFailures = [];
  consoleErrors = [];
  return result;
}

async function selectBot(bot: RegistryBot): Promise<void> {
  await page.evaluate((id) => localStorage.setItem('ftSelectedBot', id), botId(bot));
}

test.describe.serial('live dashboard', () => {
  test.beforeAll(async ({ browser }) => {
    mkdirSync(SHOTS_DIR, { recursive: true });
    context = await browser.newContext();
    page = await context.newPage();
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/') && response.status() >= 400) {
        apiFailures.push(`${response.status()} ${response.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(message.text()))) {
        consoleErrors.push(message.text().slice(0, 300));
      }
    });
    const response = await page.request.get('/api/bots/_registry');
    expect(response.ok()).toBe(true);
    bots = (await response.json()).bots;
  });

  test.afterAll(async () => {
    writeFileSync(join(RESULTS_DIR, 'summary.json'), JSON.stringify({ bots, results }, null, 2));
    const rows = bots
      .map((bot) => {
        const pages = results[bot.slug] ?? [];
        const cells = pages
          .map(
            (p) =>
              `<figure><a href="${p.screenshot}"><img src="${p.screenshot}" loading="lazy"></a><figcaption>${p.page}` +
              `${p.apiFailures.length ? ` · <b class=bad>${p.apiFailures.length} API errors</b>` : ''}` +
              `${p.consoleErrors.length ? ` · <b class=warn>${p.consoleErrors.length} console errors</b>` : ''}` +
              ` · charts ${p.charts}${p.notes.length ? ` · ${p.notes.join('; ')}` : ''}</figcaption></figure>`,
          )
          .join('');
        return `<section><h2>${bot.display_name} <small>${bot.engine} · ${bot.slug}</small></h2><div class=row>${cells}</div></section>`;
      })
      .join('\n');
    writeFileSync(
      join(RESULTS_DIR, 'index.html'),
      `<!doctype html><meta charset=utf-8><title>Dashboard E2E gallery</title><style>body{font-family:sans-serif;margin:1rem}` +
        `.row{display:flex;gap:.5rem;overflow-x:auto}figure{margin:0;width:420px;flex:none}img{width:420px;border:1px solid #ccc}` +
        `figcaption{font-size:12px}.bad{color:#c00}.warn{color:#b60}small{color:#666;font-weight:normal}</style>` +
        `<h1>Dashboard E2E gallery</h1><p>${new Date().toISOString()}</p>${rows}`,
    );
    await context.close();
  });

  test('first visit connects every registry bot automatically', async () => {
    // Fresh browser, nothing in local storage: opening any page starts auto-connect.
    await page.goto('/');
    await settle(page);
    await capture('_global', 'home');
    await page.goto('/login');
    const connectable = bots.filter((bot) => bot.connected).length;
    await expect(page.getByText(`${connectable} of ${bots.length} bots connected`)).toBeVisible({ timeout: 60_000 });
    const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ftAuthLoginInfo') ?? '{}')));
    expect(stored.length).toBe(connectable);
    await settle(page);
    await capture('_global', 'login');
  });

  test('cold load of /compare lists every bot and opens on one with data', async ({ browser }) => {
    // A brand-new browser profile straight onto Compare: no local storage, no prior page.
    const fresh = await browser.newContext();
    const cold = await fresh.newPage();
    await cold.goto('/compare/overview');
    await expect(cold.locator('h2:has-text("Report Comparison") + p')).not.toContainText('Loading reports', { timeout: 20_000 });
    await cold.getByRole('combobox').first().waitFor();
    const selector = cold.locator('h2:has-text("Report Comparison")').locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('combobox').first();
    await selector.click();
    const options = await cold.getByRole('option').count();
    expect(options).toBe(bots.length);
    await cold.keyboard.press('Escape');
    await cold.screenshot({ path: join(SHOTS_DIR, 'cold-compare.png'), fullPage: true });
    // The default must be a bot that has numbers, not an INSUFFICIENT_HISTORY one.
    await expect(cold.getByText('Total Profit', { exact: true })).toBeVisible();
    await expect(cold.getByTestId('report-status-notice')).toHaveCount(0);
    await fresh.close();
  });

  test('multi-bot dashboard and lists render for all bots', async () => {
    for (const [name, path] of [
      ['dashboard', '/dashboard'],
      ['open-trades', '/open_trades'],
      ['trade-history', '/trade_history'],
      ['balance', '/balance'],
    ] as const) {
      await page.goto(path);
      await settle(page, 6000);
      await capture('_global', name);
    }
  });

  test('every bot: trade view, graph, reports and comparison', async () => {
    // E2E_ONLY=slug1,slug2 re-checks a subset without walking all bots.
    const only = (process.env.E2E_ONLY ?? '').split(',').filter(Boolean);
    for (const bot of bots.filter((b) => b.connected && (only.length === 0 || only.includes(b.slug)))) {
      await test.step(bot.slug, async () => {
        await page.goto('/login');
        await selectBot(bot);

        await page.goto('/trade');
        await settle(page, 1500);
        const notes: string[] = [];
        if (bot.read_only) {
          await page.getByTestId('read-only-controls').waitFor({ timeout: 20_000 }).catch(() => undefined);
        }
        notes.push(`chart: ${await waitForChart(page)}`);
        await page.waitForTimeout(1500);
        const readOnlyBadge = await page.getByTestId('read-only-controls').count();
        if (bot.read_only && readOnlyBadge === 0) notes.push('controls NOT hidden');
        if (bot.read_only && readOnlyBadge > 0) notes.push('read-only controls');
        const trade = await capture(bot.slug, 'trade', notes);
        expect.soft(trade.apiFailures, `${bot.slug} /trade API failures`).toEqual([]);

        await page.goto('/graph');
        await settle(page, 1500);
        const graphState = await waitForChart(page);
        await page.waitForTimeout(1500);
        const graph = await capture(bot.slug, 'graph', [`chart: ${graphState}`]);
        expect.soft(graph.apiFailures, `${bot.slug} /graph API failures`).toEqual([]);

        if (bot.has_reports) {
          await page.goto(`/reports?bot=${bot.slug}`);
          const frame = page.getByTestId('report-frame');
          // Large reports (up to 70 MB) wait behind a "Load report" prompt.
          await expect.soft(frame.or(page.getByTestId('report-load-prompt')), `${bot.slug} report frame or prompt`).toBeVisible({ timeout: 30_000 });
          await settle(page, 4000);
          const report = await capture(bot.slug, 'report');
          expect.soft(report.apiFailures, `${bot.slug} /reports API failures`).toEqual([]);
        }

        // Every bot is selectable in Compare and shows its own numbers (central bundle
        // or fleet report), or a clear status banner, never an unresolved "Loading".
        await page.goto(`/compare/overview?bot=${botId(bot)}`);
        await settle(page, 3000);
        const header = (await page.locator('h2:has-text("Report Comparison") + p').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
        expect.soft(header, `${bot.slug} compare header`).toContain(bot.display_name.split(' ')[0]);
        expect.soft(header, `${bot.slug} compare header`).not.toContain('Loading reports');
        const compare = await capture(bot.slug, 'compare', [header.slice(0, 80)]);
        expect.soft(compare.apiFailures, `${bot.slug} /compare API failures`).toEqual([]);
        for (const tab of ['timeline', 'pairs', 'trades']) {
          await page.goto(`/compare/${tab}?bot=${botId(bot)}`);
          await settle(page, 2500);
          const sub = await capture(bot.slug, `compare-${tab}`);
          expect.soft(sub.apiFailures, `${bot.slug} /compare/${tab} API failures`).toEqual([]);
        }
      });
    }
  });
});
