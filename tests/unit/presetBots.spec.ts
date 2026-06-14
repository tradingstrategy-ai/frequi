import { describe, expect, it } from 'vitest';

import {
  getComparisonApiBase,
  getPresetBotById,
  getPresetBots,
  isPresetBotId,
} from '@/config/presetBots';

describe('presetBots', () => {
  it('returns the expected stable preset bot ids and default URLs', () => {
    const presetBots = getPresetBots();

    expect(presetBots.map((bot) => bot.botId)).toEqual([
      // FT live (dynamic universe)
      'ichiv2-ls-hyperliquid-live',
      'ichiv3-ls-hyperliquid-live',
      'ichiv3-ls-hyperliquid-vault-live',
      'ichiv2-ls-aster-live',
      'ichiv3-ls-aster-live',
      // FT static (48-pair baseline pairlist)
      'ichiv2-ls-hyperliquid-static',
      'ichiv3-ls-hyperliquid-static',
      'ichiv2-ls-aster-static',
      'ichiv3-ls-aster-static',
      'ichiv3-ls-gate-static',
      // NT vaults (one Freqtrade-compatible api_server per vault)
      'nt-opencz-vault',
      'nt-contrarian-funding',
      'nt-rwa-vault',
      'nt-weekend-wick',
    ]);
    expect(getComparisonApiBase()).toBe('http://localhost:8100');

    // FT bots default to the freqtrade-server tailnet IP.
    expect(getPresetBotById('ichiv2-ls-hyperliquid-live')?.botUrl).toBe(
      'http://100.109.171.15:9100',
    );
    expect(getPresetBotById('ichiv3-ls-gate-static')?.botUrl).toBe('http://100.109.171.15:9116');

    // NT vaults default to the nautilius tailnet IP.
    expect(getPresetBotById('nt-opencz-vault')?.botUrl).toBe('http://100.90.145.1:8101');
    expect(getPresetBotById('nt-weekend-wick')?.botUrl).toBe('http://100.90.145.1:8131');

    expect(isPresetBotId('nt-opencz-vault')).toBe(true);
    expect(isPresetBotId('ftbot.1')).toBe(false);
    // Decommissioned bots from the previous list should no longer be preset bots.
    expect(isPresetBotId('nt-ichiv3-solo')).toBe(false);
    expect(isPresetBotId('nt-multi-strategy')).toBe(false);
    expect(isPresetBotId('ichiv2-ls-modetrade-live')).toBe(false);
  });

  it('groups bot types correctly', () => {
    const presetBots = getPresetBots();
    const ftBots = presetBots.filter((b) => b.botType === 'FT');
    const ntBots = presetBots.filter((b) => b.botType === 'NT');
    expect(ftBots.length).toBe(10);
    expect(ntBots.length).toBe(4);
  });
});
