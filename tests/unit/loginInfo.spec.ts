import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('loginInfo demo preload', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('seeds the NT preset bots and selects the multi-strategy bot', async () => {
    const { seedDemoPresetBots, loggedInBots } = await import('@/composables/loginInfo');

    const seeded = seedDemoPresetBots(true);

    expect(seeded).toEqual([
      'ichiv2-ls-hyperliquid-live',
      'ichiv3-ls-hyperliquid-live',
      'nt-ichiv3-solo',
      'nt-multi-strategy',
    ]);
    expect(Object.keys(loggedInBots.value)).toEqual([
      'ichiv2-ls-hyperliquid-live',
      'ichiv3-ls-hyperliquid-live',
      'nt-ichiv3-solo',
      'nt-multi-strategy',
    ]);
    expect(localStorage.getItem('ftSelectedBot')).toBe('ichiv3-ls-hyperliquid-live');

    expect(loggedInBots.value['nt-multi-strategy']).toMatchObject({
      botName: 'NT Multi-Strategy Vault',
      botUrl: 'http://localhost:8101',
      sortId: 4,
    });
  });
});
