import type { BotDescriptor } from '@/types';

export interface PresetBotDefinition extends BotDescriptor {
  description: string;
  botType: 'FT' | 'NT';
}

function withDefault(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value : fallback;
}

export function getComparisonApiBase(): string {
  return withDefault(import.meta.env.VITE_COMPARISON_API_BASE, 'http://localhost:8100');
}

export function getPresetBots(): PresetBotDefinition[] {
  return [
    {
      botId: 'ichiv2-ls-hyperliquid-live',
      botName: 'IchiV2 HL Live',
      botUrl: withDefault(import.meta.env.VITE_ICHIV2_LS_HL_URL, 'http://localhost:9100'),
      sortId: 1,
      botType: 'FT',
      description: 'Freqtrade live bot for IchiV2 on Hyperliquid.',
    },
    {
      botId: 'ichiv3-ls-hyperliquid-live',
      botName: 'IchiV3 HL Live',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_HL_URL, 'http://localhost:9103'),
      sortId: 2,
      botType: 'FT',
      description: 'Freqtrade live bot for IchiV3 on Hyperliquid.',
    },
    {
      botId: 'nt-ichiv3-solo',
      botName: 'NT IchiV3 Solo',
      botUrl: withDefault(import.meta.env.VITE_NT_ICHIV3_SOLO_URL, 'http://localhost:8101/ichiv3'),
      sortId: 3,
      botType: 'NT',
      description: 'Nautilus virtual bot view for the IchiV3 solo strategy.',
    },
    {
      botId: 'nt-multi-strategy',
      botName: 'NT Multi-Strategy Vault',
      botUrl: withDefault(import.meta.env.VITE_NT_MULTI_STRATEGY_URL, 'http://localhost:8101'),
      sortId: 4,
      botType: 'NT',
      description: 'Nautilus aggregate vault bot view.',
    },
  ];
}

export function getPresetBotById(botId: string): PresetBotDefinition | undefined {
  return getPresetBots().find((bot) => bot.botId === botId);
}

export function isPresetBotId(botId: string): boolean {
  return getPresetBots().some((bot) => bot.botId === botId);
}
