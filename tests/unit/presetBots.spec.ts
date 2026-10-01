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
      // Production bot APIs are proxied through the FreqUI origin.
      'orchestrator_gmx_ai_gmx_vault',
      'orchestrator_apex_vault',
      'dipbuyer_apex_standalone',
      'derive-2sleeve-mainnet',
    ]);
    expect(getComparisonApiBase()).toBe('/api/comparison');

    // FT bots default to the freqtrade-server tailnet IP.
    expect(getPresetBotById('ichiv2-ls-hyperliquid-live')?.botUrl).toBe(
      'http://100.109.171.15:9100',
    );
    expect(getPresetBotById('ichiv3-ls-gate-static')?.botUrl).toBe('http://100.109.171.15:9116');

    // NT vaults default to the nautilius tailnet IP.
    expect(getPresetBotById('nt-opencz-vault')?.botUrl).toBe('http://100.90.145.1:8101');
    expect(getPresetBotById('nt-weekend-wick')?.botUrl).toBe('http://100.90.145.1:8131');
    expect(Object.fromEntries(presetBots.map(({ botId, botUrl }) => [botId, botUrl]))).toEqual({
      'ichiv2-ls-hyperliquid-live': 'http://100.109.171.15:9100',
      'ichiv3-ls-hyperliquid-live': 'http://100.109.171.15:9103',
      'ichiv3-ls-hyperliquid-vault-live': 'http://100.109.171.15:9106',
      'ichiv2-ls-aster-live': 'http://100.109.171.15:9101',
      'ichiv3-ls-aster-live': 'http://100.109.171.15:9104',
      'ichiv2-ls-hyperliquid-static': 'http://100.109.171.15:9110',
      'ichiv3-ls-hyperliquid-static': 'http://100.109.171.15:9113',
      'ichiv2-ls-aster-static': 'http://100.109.171.15:9111',
      'ichiv3-ls-aster-static': 'http://100.109.171.15:9114',
      'ichiv3-ls-gate-static': 'http://100.109.171.15:9116',
      'nt-opencz-vault': 'http://100.90.145.1:8101',
      'nt-contrarian-funding': 'http://100.90.145.1:8111',
      'nt-rwa-vault': 'http://100.90.145.1:8121',
      'nt-weekend-wick': 'http://100.90.145.1:8131',
      orchestrator_gmx_ai_gmx_vault: '/api/bots/gmx',
      orchestrator_apex_vault: '/api/bots/apex',
      dipbuyer_apex_standalone: '/api/bots/dipbuyer',
      'derive-2sleeve-mainnet': '/api/bots/derive',
    });

    expect(presetBots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          botId: 'orchestrator_gmx_ai_gmx_vault',
          botName: 'GMX AI Vault',
          botUrl: '/api/bots/gmx',
          botType: 'FT',
        }),
        expect.objectContaining({
          botId: 'orchestrator_apex_vault',
          botName: 'Apex Vault',
          botUrl: '/api/bots/apex',
          botType: 'FT',
        }),
        expect.objectContaining({
          botId: 'dipbuyer_apex_standalone',
          botName: 'DipBuyer Apex',
          botUrl: '/api/bots/dipbuyer',
          botType: 'FT',
        }),
        expect.objectContaining({
          botId: 'derive-2sleeve-mainnet',
          botName: 'Derive 2 Sleeve',
          botUrl: '/api/bots/derive',
          botType: 'NT',
        }),
      ]),
    );
    for (const bot of presetBots) {
      expect(bot).not.toHaveProperty('username');
      expect(bot).not.toHaveProperty('password');
      expect(bot).not.toHaveProperty('accessToken');
      expect(bot).not.toHaveProperty('refreshToken');
    }

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
    expect(ftBots.length).toBe(13);
    expect(ntBots.length).toBe(5);
  });
});
