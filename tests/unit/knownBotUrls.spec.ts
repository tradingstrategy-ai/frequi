import { describe, expect, it } from 'vitest';

import { findProxiedBotRoute, toProxiedBotUrl } from '@/utils/knownBotUrls';

const DASHBOARD_HOST = '100.98.110.123';

describe('knownBotUrls', () => {
  it('routes the public bot hostnames through the same-origin proxy', () => {
    expect(
      toProxiedBotUrl('http://pavel-multistrategy-gmx.tradingstrategy.ai', DASHBOARD_HOST),
    ).toBe('/api/bots/gmx');
    expect(toProxiedBotUrl('http://apex-multistrategy.tradingstrategy.ai/', DASHBOARD_HOST)).toBe(
      '/api/bots/apex',
    );
    expect(
      toProxiedBotUrl('HTTP://Pavel-Multistrategy-GMX.TradingStrategy.ai ', DASHBOARD_HOST),
    ).toBe('/api/bots/gmx');
  });

  it('routes bot ports on the dashboard host through the proxy', () => {
    expect(toProxiedBotUrl('http://100.98.110.123:9098', DASHBOARD_HOST)).toBe('/api/bots/gmx');
    expect(toProxiedBotUrl('http://100.98.110.123:9109/', DASHBOARD_HOST)).toBe('/api/bots/apex');
    expect(toProxiedBotUrl('http://100.98.110.123:9110', DASHBOARD_HOST)).toBe(
      '/api/bots/dipbuyer',
    );
    expect(toProxiedBotUrl('http://100.98.110.123:8114', DASHBOARD_HOST)).toBe('/api/bots/derive');
  });

  it('leaves bot ports on any other host alone', () => {
    expect(toProxiedBotUrl('http://100.109.171.15:9098', DASHBOARD_HOST)).toBe(
      'http://100.109.171.15:9098',
    );
    expect(toProxiedBotUrl('http://localhost:9098', DASHBOARD_HOST)).toBe('http://localhost:9098');
  });

  it('does not rewrite unknown ports, custom paths, or non-URLs', () => {
    expect(toProxiedBotUrl('http://100.98.110.123:9198', DASHBOARD_HOST)).toBe(
      'http://100.98.110.123:9198',
    );
    expect(toProxiedBotUrl('http://100.98.110.123', DASHBOARD_HOST)).toBe('http://100.98.110.123');
    expect(
      toProxiedBotUrl('http://pavel-multistrategy-gmx.tradingstrategy.ai/custom', DASHBOARD_HOST),
    ).toBe('http://pavel-multistrategy-gmx.tradingstrategy.ai/custom');
    expect(toProxiedBotUrl('/api/bots/gmx', DASHBOARD_HOST)).toBe('/api/bots/gmx');
    expect(toProxiedBotUrl('not a url', DASHBOARD_HOST)).toBe('not a url');
    expect(findProxiedBotRoute('', DASHBOARD_HOST)).toBeUndefined();
    expect(findProxiedBotRoute(undefined, DASHBOARD_HOST)).toBeUndefined();
  });
});
