import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('loginInfo demo preload', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('seeds every preset bot and selects ichiv3-ls-hyperliquid-live by default', async () => {
    const { seedDemoPresetBots, loggedInBots } = await import('@/composables/loginInfo');

    const seeded = seedDemoPresetBots(true);

    // Every preset bot should get seeded into local login storage.
    expect(seeded).toContain('ichiv2-ls-hyperliquid-live');
    expect(seeded).toContain('ichiv3-ls-hyperliquid-live');
    expect(seeded).toContain('ichiv3-ls-hyperliquid-vault-live');
    expect(seeded).toContain('ichiv3-ls-gate-static');
    expect(seeded).toContain('nt-opencz-vault');
    expect(seeded).toContain('nt-weekend-wick');
    expect(seeded.length).toBe(14); // 10 FT + 4 NT

    // The preferred starting bot is ichiv3 HL Live (top of fallback chain).
    expect(localStorage.getItem('ftSelectedBot')).toBe('ichiv3-ls-hyperliquid-live');

    // Each seeded bot ends up in the loggedInBots map with its preset URL.
    expect(loggedInBots.value['nt-opencz-vault']).toMatchObject({
      botName: 'NT OpenCZ Vault',
      botUrl: 'http://100.90.145.1:8101',
      sortId: 30,
    });
    expect(loggedInBots.value['ichiv2-ls-hyperliquid-live']).toMatchObject({
      botName: 'IchiV2 HL Live',
      botUrl: 'http://100.109.171.15:9100',
      sortId: 10,
    });
  });
});
