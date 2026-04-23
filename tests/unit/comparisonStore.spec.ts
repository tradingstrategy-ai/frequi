import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/stores/ftbot', () => ({
  createBotSubStore: (botId: string, botName: string) => ({
    botAdded: vi.fn(),
    updateBot: vi.fn(),
    logout: vi.fn(),
    $dispose: vi.fn(),
    setAutoRefresh: vi.fn(),
    autoRefresh: true,
    isSelected: true,
    isBotOnline: true,
    isBotLoggedIn: true,
    uiBotName: botName,
    botName,
    botId,
    botState: {},
    openTrades: [],
    trades: [],
    balance: {},
    dailyStats: { data: [] },
    weeklyStats: { data: [] },
    monthlyStats: { data: [] },
  }),
}));

import { useBotStore } from '@/stores/ftbotwrapper';
import { useComparisonStore } from '@/stores/comparisonStore';

const apiMocks = vi.hoisted(() => ({
  fetchComparisonBots: vi.fn(),
  fetchOverview: vi.fn(),
  fetchTimeline: vi.fn(),
  fetchPairs: vi.fn(),
  fetchTrades: vi.fn(),
  fetchComparisonCandles: vi.fn(),
  triggerComparisonBacktest: vi.fn(),
  fetchComparisonBacktestStatus: vi.fn(),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    add: vi.fn(),
  }),
}));

vi.mock('@/composables/comparisonApi', () => ({
  ...apiMocks,
}));

describe('comparisonStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiMocks.fetchComparisonBots.mockReset();
    apiMocks.fetchOverview.mockReset();
    apiMocks.fetchTimeline.mockReset();
    apiMocks.fetchPairs.mockReset();
    apiMocks.fetchTrades.mockReset();
    apiMocks.fetchComparisonCandles.mockReset();
    apiMocks.triggerComparisonBacktest.mockReset();
    apiMocks.fetchComparisonBacktestStatus.mockReset();
  });

  it('caches overview responses per bot and timerange', async () => {
    const botStore = useBotStore();
    botStore.addBot({
      botId: 'ichiv3-ls-hyperliquid-live',
      botName: 'IchiV3 HL Live',
      botUrl: 'http://localhost:9103',
      sortId: 1,
    });
    botStore.selectBot('ichiv3-ls-hyperliquid-live');

    apiMocks.fetchComparisonBots.mockResolvedValue({
      bots: [
        {
          bot_id: 'ichiv3-ls-hyperliquid-live',
          bot_type: 'FT',
          display_name: 'IchiV3 HL Live',
          is_vault: false,
        },
      ],
    });
    apiMocks.fetchOverview.mockResolvedValue({
      live_metrics: {
        total_trades: 2,
        win_rate_pct: 50,
        profit_factor: 1.3,
        max_drawdown_pct: 12,
        sharpe_ratio: 0.8,
        avg_duration_hours: 8,
        total_profit_pct: 14,
        expectancy: 0.2,
      },
      bt_metrics: {
        total_trades: 4,
        win_rate_pct: 75,
        profit_factor: 1.8,
        max_drawdown_pct: 7,
        sharpe_ratio: 1.1,
        avg_duration_hours: 5,
        total_profit_pct: 22,
        expectancy: 0.4,
      },
      equity_curve: {
        live: [],
        bt: [],
      },
      match_summary: {
        matched: 3,
        live_only: 1,
        bt_only: 2,
        match_rate_pct: 60,
      },
      daily_profit: [],
      monthly_heatmap: [],
    });

    const store = useComparisonStore();

    await store.ensureComparisonBots();
    expect(store.isActiveBotSupported).toBe(true);

    await store.loadOverview('ichiv3-ls-hyperliquid-live', '20260101-20260413');
    await store.loadOverview('ichiv3-ls-hyperliquid-live', '20260101-20260413');

    expect(apiMocks.fetchOverview).toHaveBeenCalledTimes(1);
    expect(store.overviewData?.match_summary.matched).toBe(3);
  });

  it('does not load overview for unsupported bots', async () => {
    const botStore = useBotStore();
    botStore.addBot({
      botId: 'ftbot.1',
      botName: 'Manual Bot',
      botUrl: 'http://localhost:9999',
      sortId: 1,
    });
    botStore.selectBot('ftbot.1');

    apiMocks.fetchComparisonBots.mockResolvedValue({
      bots: [],
    });

    const store = useComparisonStore();

    await store.ensureComparisonBots();
    await store.loadOverview('ftbot.1', '');

    expect(store.isActiveBotSupported).toBe(false);
    expect(apiMocks.fetchOverview).not.toHaveBeenCalled();
    expect(store.overviewData).toBeNull();
  });
});
