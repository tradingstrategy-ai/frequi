import { describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

vi.mock('@/composables/useToast', () => ({ useToast: () => ({ add: vi.fn() }) }));

// Every read answers, except /balance, which a slow bot answers with the gateway's 503.
const api = vi.hoisted(() => ({
  get: vi.fn((url: string) => {
    if (url === '/balance') {
      return Promise.reject(
        Object.assign(new Error('Request failed with status code 503'), {
          isAxiosError: true,
          response: { status: 503 },
        }),
      );
    }
    return Promise.resolve({ data: url === '/whitelist' ? { whitelist: [] } : [] });
  }),
  post: vi.fn(),
}));
vi.mock('@/composables/api', () => ({ useApi: () => ({ api }) }));

import { createBotSubStore } from '@/stores/ftbot';

describe('refreshSlow', () => {
  it('finishes when one read fails, instead of rejecting for the unawaited callers', async () => {
    const pinia = createPinia();
    pinia.use(piniaPluginPersistedstate);
    createApp({}).use(pinia);
    setActivePinia(pinia);
    const bot = createBotSubStore('slow-bot', 'Slow bot');
    await expect(bot.refreshSlow(true)).resolves.toBeUndefined();
    expect(api.get).toHaveBeenCalledWith('/trades', expect.anything());
  });
});

describe('getPairCandles', () => {
  it('drops an answer for a strategy that is no longer selected', async () => {
    const pinia = createPinia();
    pinia.use(piniaPluginPersistedstate);
    createApp({}).use(pinia);
    setActivePinia(pinia);
    let release: (value: unknown) => void = () => {};
    api.get.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)) as never);
    const bot = createBotSubStore('chart-bot', 'Chart bot');
    bot.chartStrategy = 'StrategyA';
    const pending = bot.getPairCandles({ pair: 'BTC', timeframe: '1h', columns: [] });
    bot.chartStrategy = 'StrategyB';
    release({ data: { columns: [], data: [[1]] } });
    await pending;
    expect(bot.candleData['BTC__1h']).toBeUndefined();
  });
});
