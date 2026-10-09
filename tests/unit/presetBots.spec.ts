import { describe, expect, it } from 'vitest';

import {
  getComparisonApiBase,
  getPresetBotById,
  getPresetBots,
  isPresetBotId,
} from '@/config/presetBots';

describe('presetBots', () => {
  it('returns the expected stable preset bot ids and same-origin URLs', () => {
    const presetBots = getPresetBots();

    // Production bot APIs are proxied through the FreqUI origin.
    expect(presetBots.map((bot) => bot.botId)).toEqual([
      'orchestrator_gmx_ai_gmx_vault',
      'orchestrator_apex_vault',
      'dipbuyer_apex_standalone',
      'funding_tail_reversal_gmx_standalone',
      'derive-2sleeve-mainnet',
    ]);
    expect(getComparisonApiBase()).toBe('/api/comparison');

    expect(Object.fromEntries(presetBots.map(({ botId, botUrl }) => [botId, botUrl]))).toEqual({
      orchestrator_gmx_ai_gmx_vault: '/api/bots/gmx',
      orchestrator_apex_vault: '/api/bots/apex',
      dipbuyer_apex_standalone: '/api/bots/dipbuyer',
      funding_tail_reversal_gmx_standalone: '/api/bots/ftr',
      'derive-2sleeve-mainnet': '/api/bots/derive',
    });
    expect(getPresetBotById('funding_tail_reversal_gmx_standalone')).toMatchObject({
      botName: 'Funding Tail Reversal GMX',
      botUrl: '/api/bots/ftr',
      botType: 'FT',
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

    expect(isPresetBotId('funding_tail_reversal_gmx_standalone')).toBe(true);
    expect(isPresetBotId('ftbot.1')).toBe(false);
    // Retired bots are no longer preset cards.
    for (const retired of [
      'ichiv2-ls-hyperliquid-live',
      'ichiv3-ls-hyperliquid-live',
      'ichiv3-ls-gate-static',
      'nt-opencz-vault',
      'nt-contrarian-funding',
      'nt-rwa-vault',
      'nt-weekend-wick',
      'nt-ichiv3-solo',
      'nt-multi-strategy',
      'ichiv2-ls-modetrade-live',
    ]) {
      expect(isPresetBotId(retired)).toBe(false);
    }
  });

  it('keeps preset bot ids and sort ids unique and groups bot types', () => {
    const presetBots = getPresetBots();
    expect(new Set(presetBots.map((b) => b.botId)).size).toBe(presetBots.length);
    expect(new Set(presetBots.map((b) => b.sortId)).size).toBe(presetBots.length);
    expect(presetBots.filter((b) => b.botType === 'FT').length).toBe(4);
    expect(presetBots.filter((b) => b.botType === 'NT').length).toBe(1);
  });
});
