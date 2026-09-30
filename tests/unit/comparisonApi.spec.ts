import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => {
  const get = vi.fn();
  return { create: vi.fn(() => ({ get })), get };
});
vi.mock('axios', () => ({ default: { create: axiosMock.create } }));

import {
  fetchComparisonBots,
  fetchComparisonCandles,
  fetchOverview,
  fetchPairs,
  fetchTimeline,
  fetchTrades,
} from '@/composables/comparisonApi';

describe('comparisonApi', () => {
  beforeEach(() => {
    axiosMock.get.mockReset().mockImplementation(async () => ({ data: { ok: true } }));
  });

  it('uses a same-origin comparison API client without cross-origin credentials', async () => {
    // The module creates one client at import time; assert the configured origin
    // and credentials rather than depending on an absolute deployment URL.
    expect(axiosMock.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: '/api/comparison',
      withCredentials: false,
    }));
    await fetchComparisonBots();
    expect(axiosMock.get).toHaveBeenCalledWith('/bots');
  });

  it('passes timerange and sleeve to every report page request', async () => {
    await fetchOverview('derive/report', '20260901-20260929', 'hedged');
    await fetchTimeline('derive-report', '20260901-20260929', 'hedged');
    await fetchPairs('derive-report', '20260901-20260929', 'hedged');
    await fetchTrades('derive-report', '20260901-20260929', 'hedged');
    await fetchComparisonCandles('derive-report', 'BTC/USDT', '1h', '20260901-20260929', 'hedged');

    expect(axiosMock.get).toHaveBeenNthCalledWith(1, '/derive%2Freport/overview', {
      params: { timerange: '20260901-20260929', sleeve: 'hedged' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(2, '/derive-report/timeline', {
      params: { timerange: '20260901-20260929', sleeve: 'hedged' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(3, '/derive-report/pairs', {
      params: { timerange: '20260901-20260929', sleeve: 'hedged' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(4, '/derive-report/trades', {
      params: { timerange: '20260901-20260929', sleeve: 'hedged' },
    });
    expect(axiosMock.get).toHaveBeenNthCalledWith(5, '/derive-report/candles', {
      params: {
        pair: 'BTC/USDT', timeframe: '1h', timerange: '20260901-20260929', sleeve: 'hedged',
      },
    });
  });

  it('omits empty optional timerange and sleeve parameters', async () => {
    await fetchOverview('derive-report');
    expect(axiosMock.get).toHaveBeenCalledWith('/derive-report/overview', { params: {} });
  });
});
