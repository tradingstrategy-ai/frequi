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
      'ichiv2-ls-hyperliquid-live',
      'ichiv3-ls-hyperliquid-live',
      'nt-ichiv3-solo',
      'nt-multi-strategy',
    ]);
    expect(getComparisonApiBase()).toBe('http://localhost:8100');
    expect(getPresetBotById('ichiv2-ls-hyperliquid-live')?.botUrl).toBe('http://localhost:9100');
    expect(getPresetBotById('nt-ichiv3-solo')?.botUrl).toBe('http://localhost:8101/ichiv3');
    expect(isPresetBotId('nt-multi-strategy')).toBe(true);
    expect(isPresetBotId('ftbot.1')).toBe(false);
  });
});
