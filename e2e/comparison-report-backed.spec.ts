import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const generatedAt = '2026-09-29T12:00:00.000Z';
const timestamp = (daysAgo: number) => new Date(Date.parse(generatedAt) - daysAgo * 86_400_000).toISOString();

function makeReport(
  snapshot_id: string,
  status: string,
  overrides: Partial<{
    reason: string | null;
    generated_at: string | null;
    stale: boolean;
    unavailable_fields: string[];
    annotations: { code: string; note: string }[];
  }> = {},
) {
  return {
    schema_version: '1',
    snapshot_id,
    status,
    reason: null,
    generated_at: generatedAt,
    report_date: '2026-09-29',
    report_window: { start: '2026-09-01', end: '2026-09-29' },
    stale: false,
    source_artifacts: ['daily-report.json'],
    unavailable_fields: [],
    annotations: [],
    ...overrides,
  };
}

const bots = [
  {
    bot_id: 'derive-2sleeve-mainnet', bot_type: 'NT' as const, display_name: 'Derive Report',
    venue: 'Derive', sleeves: ['sigcombo', 'stalebreakout'], is_vault: false,
    report: makeReport('derive-snapshot-1', 'SUCCESS', {
      unavailable_fields: ['live_metrics.sharpe_ratio'],
      annotations: [{ code: 'partial_coverage', note: 'Some live source rows are missing.' }],
    }),
  },
  {
    bot_id: 'orchestrator_gmx_ai_gmx_vault', bot_type: 'FT' as const,
    display_name: 'GMX Vault', venue: 'GMX', sleeves: [], is_vault: true,
    report: makeReport('gmx-snapshot-stale', 'STALE', {
      generated_at: timestamp(3), stale: true, reason: 'The latest successful snapshot is stale',
    }),
  },
  {
    bot_id: 'orchestrator_apex_vault', bot_type: 'FT' as const,
    display_name: 'Apex Vault', venue: 'Apex', sleeves: [], is_vault: true,
    report: makeReport('apex-snapshot-1', 'SUCCESS'),
  },
  {
    bot_id: 'dipbuyer_apex_standalone', bot_type: 'FT' as const,
    display_name: 'DipBuyer Apex', venue: 'Apex', sleeves: [], is_vault: false,
    // NOT_VALIDATED is one of the exact source-marker statuses in the reader's
    // precedence; the dashboard preserves that refusal instead of normalizing it.
    report: makeReport('dipbuyer-refusal-1', 'NOT_VALIDATED', {
      reason: 'The current report records an existing refusal state',
    }),
  },
];

type BotFixture = (typeof bots)[number];
type RouteOptions = {
  unauthorizedFirst?: boolean;
  catalogForCall?: (call: number) => BotFixture[];
};

const baseMetrics = {
  total_trades: null,
  win_rate_pct: null,
  profit_factor: null,
  max_drawdown_pct: null,
  sharpe_ratio: null,
  avg_duration_hours: null,
  total_profit_pct: null,
  expectancy: null,
};

function overviewFor(bot: BotFixture, report: ReturnType<typeof makeReport>, timerange: boolean) {
  const successfulSnapshot = report.status === 'SUCCESS' || report.status === 'STALE';
  const accountSeriesAvailable = bot.bot_type === 'FT' && !timerange && successfulSnapshot;
  const reportWithAvailability = timerange && bot.bot_type === 'FT'
    ? {
        ...report,
        unavailable_fields: [
          ...new Set([
            ...report.unavailable_fields,
            'equity_curve', 'daily_profit', 'monthly_heatmap',
            'live_metrics.total_profit_pct', 'bt_metrics.total_profit_pct',
          ]),
        ],
      }
    : report;
  return {
    live_metrics: baseMetrics,
    bt_metrics: baseMetrics,
    equity_curve: accountSeriesAvailable
      ? {
          live: [
            { date: '2026-09-01T00:00:00Z', value: 10_000 },
            { date: generatedAt, value: 10_650 },
          ],
          bt: [
            { date: '2026-09-01T00:00:00Z', value: 10_000 },
            { date: generatedAt, value: 10_420 },
          ],
        }
      : { live: [], bt: [] },
    match_summary: { matched: null, live_only: null, bt_only: null, match_rate_pct: null },
    daily_profit: accountSeriesAvailable
      ? [{ date: '2026-09-29', live_profit: 650, bt_profit: 420, live_count: 2, bt_count: 2 }]
      : [],
    monthly_heatmap: accountSeriesAvailable
      ? [{ year: 2026, month: 9, live_return: 6.5, bt_return: 4.2 }]
      : [],
    report: reportWithAvailability,
  };
}

function timelineFor(report: ReturnType<typeof makeReport>) {
  const successfulSnapshot = report.status === 'SUCCESS' || report.status === 'STALE';
  return {
    gantt: [],
    matched_trades: successfulSnapshot ? [{
      live_trade: {
        pair: 'BTC/USDT', direction: null, open_date: generatedAt, close_date: generatedAt,
        open_rate: null, close_rate: null, profit_ratio: null,
      },
      bt_trade: {
        pair: 'BTC/USDT', direction: null, open_date: generatedAt, close_date: generatedAt,
        open_rate: null, close_rate: null, profit_ratio: null,
      },
      entry_delay_minutes: null, exit_delay_minutes: null, entry_slippage_pct: null,
      exit_slippage_pct: null, profit_diff_pct: null,
    }] : [],
    delays: {}, unmatched: {}, match_summary: { matched: 1 }, report,
  };
}

async function installReportRoutes(page: Page, options: RouteOptions = {}) {
  const requests: string[] = [];
  let botCatalogCallCount = 0;
  let currentBots: BotFixture[] = bots;
  await page.route('**/api/comparison/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);
    if (url.pathname === '/api/comparison/auth-check') {
      // Playwright route.fulfill rejects redirect status codes; emulate the
      // successful top-level auth-check navigation while the separate Caddy
      // smoke verifies the real 303 redirect at the proxy boundary.
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<script>window.location.replace("/compare/overview")</script>',
      });
      return;
    }
    if (url.pathname === '/api/comparison/bots') {
      botCatalogCallCount += 1;
      if (botCatalogCallCount === 1 && options.unauthorizedFirst) {
        await route.fulfill({ status: 401, json: { detail: 'Authentication required' } });
      } else {
        currentBots = options.catalogForCall?.(botCatalogCallCount) ?? bots;
        await route.fulfill({ json: { bots: currentBots } });
      }
      return;
    }

    const match = url.pathname.match(/^\/api\/comparison\/([^/]+)\/(overview|timeline|pairs|trades|candles)$/);
    const selected = match && currentBots.find((bot) => bot.bot_id === decodeURIComponent(match[1]!));
    if (!match || !selected) {
      await route.fulfill({ status: 404, json: { detail: 'Unknown report route' } });
      return;
    }
    const timerange = url.searchParams.has('timerange');
    const selectedReport = selected.report;
    switch (match[2]) {
      case 'overview':
        await route.fulfill({ json: overviewFor(selected, selectedReport, timerange) });
        return;
      case 'timeline':
        await route.fulfill({ json: timelineFor(selectedReport) });
        return;
      case 'pairs':
        await route.fulfill({
          json: {
            pair_heatmap: [], pair_overlap: {}, exit_reasons: [], categories: [],
            profit_distribution: {}, report: selectedReport,
          },
        });
        return;
      case 'trades':
        await route.fulfill({
          json: {
            best_worst: {}, slippage: [], duration_boxplot: {}, by_direction: {},
            scatter: [], report: selectedReport,
          },
        });
        return;
      case 'candles':
        await route.fulfill({ json: { bt_markers: [], live_markers: [], report: selectedReport } });
        return;
    }
  });
  return { requests };
}

async function chooseBot(page: Page, botName: string) {
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: botName }).click();
  await expect(page.getByText(botName).first()).toBeVisible();
}

test('comparison is anonymous, report picker is independent, and caveats/direction/age render', async ({ page }) => {
  await page.clock.install({ time: new Date(generatedAt) });
  const { requests } = await installReportRoutes(page);
  await page.goto('/compare/overview');

  await expect(page.getByText('Derive Report').first()).toBeVisible();
  await expect(page.getByText('partial_coverage')).toBeVisible();
  await expect(page.getByText('Some live source rows are missing.')).toBeVisible();
  await expect(page.getByText('live_metrics.sharpe_ratio')).toBeVisible();
  await expect(page.getByText('0m old')).toBeVisible();
  await expect(page.getByRole('button', { name: /refresh backtest/i })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ftAuthLoginInfo') ?? '{}'))).toEqual({});
  expect(requests.some((request) => request.includes('://'))).toBe(false);
  expect(requests.every((request) => request.startsWith('/api/comparison/'))).toBe(true);

  await page.getByRole('link', { name: 'Timeline' }).click();
  await expect(page.getByText(/"direction": "Unknown"/).first()).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByText('1m old')).toBeVisible();
  expect(requests.some((request) => /refresh|trigger|backtest-status/i.test(request))).toBe(false);
});

test('all four report IDs can be selected and each selection navigates through the four views', async ({ page }) => {
  const { requests } = await installReportRoutes(page);
  await page.goto('/compare/overview');

  for (const bot of bots) {
    await chooseBot(page, bot.display_name);
    for (const [linkName, visibleHeading] of [
      ['Overview', 'Equity Curve'],
      ['Timeline', 'Match Summary'],
      ['Pairs', 'Pair Overlap'],
      ['Deep Dive', 'Best / Worst'],
    ]) {
      await page.getByRole('link', { name: linkName }).click();
      await expect(page.getByText(visibleHeading).first()).toBeVisible();
      if (linkName === 'Overview') {
        await expect.poll(() => requests.some((request) =>
          request.includes(`/api/comparison/${bot.bot_id}/overview`),
        )).toBe(true);
      }
    }
  }
});

test('multi-sleeve report selection filters requests and persists across reload', async ({ page }) => {
  const { requests } = await installReportRoutes(page);
  await page.goto('/compare/overview');
  await chooseBot(page, 'Derive Report');

  const sleevePicker = page.getByRole('combobox').nth(1);
  await sleevePicker.click();
  await page.getByRole('option', { name: 'stalebreakout' }).click();
  await expect(page).toHaveURL(/sleeve=stalebreakout/);
  await expect.poll(() => requests.some((request) => request.includes('sleeve=stalebreakout'))).toBe(true);

  await page.reload();
  await expect(page.getByRole('combobox').nth(1)).toContainText('stalebreakout');
  await expect(page).toHaveURL(/sleeve=stalebreakout/);
});

test('a direct sleeve URL hydrates after catalog load and bot changes remove incompatible queries', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const productionOrder = [...bots.slice(1), bots[0]!];
  const { requests } = await installReportRoutes(page, {
    catalogForCall: () => productionOrder,
  });
  await page.goto('/compare/overview?bot=derive-2sleeve-mainnet&sleeve=stalebreakout');
  await expect(page.getByRole('combobox').first()).toContainText('Derive Report');
  await expect(page.getByRole('combobox').nth(1)).toContainText('stalebreakout');
  await expect(page).toHaveURL(/bot=derive-2sleeve-mainnet.*sleeve=stalebreakout/);
  await expect.poll(() => requests.some((request) =>
    request.includes('/derive-2sleeve-mainnet/overview?sleeve=stalebreakout'),
  )).toBe(true);

  await chooseBot(page, 'GMX Vault');
  await expect(page).toHaveURL(/bot=orchestrator_gmx_ai_gmx_vault/);
  await expect(page).not.toHaveURL(/sleeve=/);
  await expect.poll(() => requests.some((request) =>
    request.startsWith('/api/comparison/orchestrator_gmx_ai_gmx_vault/overview') && !request.includes('sleeve='),
  )).toBe(true);
});

test('stale and refused report states stay visible', async ({ page }) => {
  await installReportRoutes(page);
  await page.goto('/compare/overview');

  await chooseBot(page, 'GMX Vault');
  await expect(page.getByText('STALE').first()).toBeVisible();
  await expect(page.getByText('This report is marked stale')).toBeVisible();

  await chooseBot(page, 'DipBuyer Apex');
  await expect(page.getByText('NOT_VALIDATED').first()).toBeVisible();
  await expect(page.getByText('The current report records an existing refusal state')).toBeVisible();
});

test('full-report FT balance series renders; timerange explains unavailable account cohorts', async ({ page }) => {
  await installReportRoutes(page);
  await page.goto('/compare/overview');
  await chooseBot(page, 'Apex Vault');

  await expect(page.getByText('Equity Curve')).toBeVisible();
  await expect(page.getByText('Realized account balance, updated at trade close.')).toBeVisible();
  await expect(page.getByText(/as of 2026-09-29T12:00:00\.000Z UTC/)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('equity_curve', { exact: true })).toHaveCount(0);

  await page.getByPlaceholder('YYYYMMDD-YYYYMMDD').fill('20260910-20260929');
  await page.getByRole('button', { name: 'Apply timerange' }).click();
  await expect(page).toHaveURL(/timerange=20260910-20260929/);
  await expect(page.getByText(/equity_curve/)).toBeVisible();
  await expect(page.getByText('No equity curve data')).toBeVisible();
  // Required product copy distinguishing entry-date filtering from close-date accounting.
  await expect(page.getByText(/entry.date.*close.date/i)).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('a changed refusal snapshot appears after bounded revalidation without a page reload', async ({ page }) => {
  await page.clock.install({ time: new Date(generatedAt) });
  const changedReport = makeReport('apex-refusal-snapshot-2', 'NOT_VALIDATED', {
    reason: 'The newest publication records a refusal', generated_at: timestamp(0),
  });
  const changedBots = bots.map((bot) => bot.bot_id === 'orchestrator_apex_vault'
    ? { ...bot, report: changedReport }
    : bot);
  const { requests } = await installReportRoutes(page, {
    catalogForCall: (call) => call >= 2 ? changedBots : bots,
  });
  await page.goto('/compare/overview');
  await chooseBot(page, 'Apex Vault');
  await expect(page.getByText('SUCCESS').first()).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  const initialUrl = page.url();

  await page.clock.fastForward(5 * 60_000);
  await expect(page.getByText('NOT_VALIDATED').first()).toBeVisible();
  await expect(page.getByText('The newest publication records a refusal')).toBeVisible();
  await expect(page.getByText('No equity curve data')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(page.url()).toBe(initialUrl);
  expect(requests.filter((request) => request.startsWith('/api/comparison/bots')).length).toBeGreaterThanOrEqual(2);
});

test('a report 401 shows the connect action and recovers after auth bootstrap', async ({ page }) => {
  await installReportRoutes(page, { unauthorizedFirst: true });

  await page.goto('/compare/overview');
  const connectLink = page.getByRole('link', { name: 'Connect to reports' });
  await expect(connectLink).toHaveAttribute('href', '/api/comparison/auth-check');
  await connectLink.click();
  await expect(page).toHaveURL(/\/compare\/overview$/);
  await expect(page.getByText('Derive Report').first()).toBeVisible();
});
