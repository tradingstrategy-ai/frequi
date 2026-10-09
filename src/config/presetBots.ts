import type { BotDescriptor } from '@/types';

export interface PresetBotDefinition extends BotDescriptor {
  description: string;
  botType: 'FT' | 'NT';
}

export function getComparisonApiBase(): string {
  return '/api/comparison';
}

// Production bots, reached through the dashboard's same-origin `/api/bots/*` proxy so the
// bots' own CORS policy never applies. Bot IDs MUST match the comparison-backend
// bot_registry rows seeded by scripts/seed_bot_registry.py.
export function getPresetBots(): PresetBotDefinition[] {
  return [
    {
      botId: 'orchestrator_gmx_ai_gmx_vault',
      botName: 'GMX AI Vault',
      botUrl: '/api/bots/gmx',
      sortId: 40,
      botType: 'FT',
      description: 'GMX AI Vault via the same-origin reports proxy.',
    },
    {
      botId: 'orchestrator_apex_vault',
      botName: 'Apex Vault',
      botUrl: '/api/bots/apex',
      sortId: 41,
      botType: 'FT',
      description: 'Apex Vault via the same-origin reports proxy.',
    },
    {
      botId: 'dipbuyer_apex_standalone',
      botName: 'DipBuyer Apex',
      botUrl: '/api/bots/dipbuyer',
      sortId: 42,
      botType: 'FT',
      description: 'DipBuyer Apex via the same-origin reports proxy.',
    },
    {
      botId: 'funding_tail_reversal_gmx_standalone',
      botName: 'Funding Tail Reversal GMX',
      botUrl: '/api/bots/ftr',
      sortId: 43,
      botType: 'FT',
      description: 'Funding Tail Reversal GMX standalone bot via the same-origin reports proxy.',
    },
    {
      botId: 'derive-2sleeve-mainnet',
      botName: 'Derive 2 Sleeve',
      botUrl: '/api/bots/derive',
      sortId: 44,
      botType: 'NT',
      description: 'Derive two-sleeve runner via the same-origin reports proxy.',
    },
  ];
}

export function getPresetBotById(botId: string): PresetBotDefinition | undefined {
  return getPresetBots().find((bot) => bot.botId === botId);
}

export function isPresetBotId(botId: string): boolean {
  return getPresetBots().some((bot) => bot.botId === botId);
}
