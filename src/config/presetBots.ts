import type { BotDescriptor } from '@/types';
import { useDashboardRegistry } from '@/composables/dashboardRegistry';

export interface PresetBotDefinition extends BotDescriptor {
  description: string;
  botType: 'FT' | 'NT';
  /** Gateway slug (registry presets only). */
  slug?: string;
  /** Writes are refused by the gateway (all NT bots; FT unless writes are enabled). */
  readOnly?: boolean;
  /** Bot publishes fleet live-vs-backtest HTML reports. */
  hasReports?: boolean;
  dryRun?: boolean;
}

export function getComparisonApiBase(): string {
  return '/api/comparison';
}

/**
 * Presets from the dashboard gateway's registry, when the dashboard has one.
 *
 * The registry (orchestrator `deploy/vitalik8-dashboard/bots.json`) is the single
 * list of bots; without a gateway this returns an empty list and the static
 * production presets below apply.
 */
function getRegistryPresets(): PresetBotDefinition[] {
  const { registry, registryBotId } = useDashboardRegistry();
  return (registry.value?.bots ?? []).map((bot, index) => ({
    botId: registryBotId(bot),
    botName: bot.display_name,
    botUrl: bot.api_route,
    sortId: 100 + index,
    botType: bot.engine,
    slug: bot.slug,
    readOnly: bot.read_only,
    hasReports: bot.has_reports,
    dryRun: bot.dry_run,
    description: [
      bot.engine === 'NT' ? 'Nautilus bot (read-only)' : 'Freqtrade bot',
      bot.dry_run ? 'dry-run' : null,
      bot.comparison_id ? 'live-vs-backtest comparison' : null,
      bot.has_reports ? 'fleet report' : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

export function getPresetBots(): PresetBotDefinition[] {
  const registryPresets = getRegistryPresets();
  return registryPresets.length > 0 ? registryPresets : getStaticPresetBots();
}

// Production bots, reached through the dashboard's same-origin `/api/bots/*` proxy so the
// bots' own CORS policy never applies. Bot IDs MUST match the comparison-backend
// bot_registry rows seeded by scripts/seed_bot_registry.py.
export function getStaticPresetBots(): PresetBotDefinition[] {
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
