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

// Tailscale defaults for the live deployment. Override per-bot via VITE_* env vars in
// .env.local (e.g. for SSH tunnels or staging). Bot IDs MUST match the comparison-backend
// bot_registry rows seeded by scripts/seed_bot_registry.py.
const FT_HOST = 'http://100.109.171.15';   // freqtrade-server
const NT_HOST = 'http://100.90.145.1';     // nautilius

export function getPresetBots(): PresetBotDefinition[] {
  return [
    // --- FT live (dynamic universe) ---
    {
      botId: 'ichiv2-ls-hyperliquid-live',
      botName: 'IchiV2 HL Live',
      botUrl: withDefault(import.meta.env.VITE_ICHIV2_LS_HL_URL, `${FT_HOST}:9100`),
      sortId: 10,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV2 on Hyperliquid (dynamic universe).',
    },
    {
      botId: 'ichiv3-ls-hyperliquid-live',
      botName: 'IchiV3 HL Live',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_HL_URL, `${FT_HOST}:9103`),
      sortId: 11,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV3 on Hyperliquid (dynamic universe).',
    },
    {
      botId: 'ichiv3-ls-hyperliquid-vault-live',
      botName: 'IchiV3 HL Vault',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_HL_VAULT_URL, `${FT_HOST}:9106`),
      sortId: 12,
      botType: 'FT',
      description: 'Freqtrade live vault — IchiV3 on Hyperliquid.',
    },
    {
      botId: 'ichiv2-ls-aster-live',
      botName: 'IchiV2 Aster Live',
      botUrl: withDefault(import.meta.env.VITE_ICHIV2_LS_ASTER_URL, `${FT_HOST}:9101`),
      sortId: 13,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV2 on Aster (dynamic universe).',
    },
    {
      botId: 'ichiv3-ls-aster-live',
      botName: 'IchiV3 Aster Live',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_ASTER_URL, `${FT_HOST}:9104`),
      sortId: 14,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV3 on Aster (dynamic universe).',
    },
    // --- FT static (48-pair baseline pairlist) ---
    {
      botId: 'ichiv2-ls-hyperliquid-static',
      botName: 'IchiV2 HL Static',
      botUrl: withDefault(import.meta.env.VITE_ICHIV2_LS_HL_STATIC_URL, `${FT_HOST}:9110`),
      sortId: 20,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV2 on Hyperliquid (48-pair static).',
    },
    {
      botId: 'ichiv3-ls-hyperliquid-static',
      botName: 'IchiV3 HL Static',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_HL_STATIC_URL, `${FT_HOST}:9113`),
      sortId: 21,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV3 on Hyperliquid (48-pair static).',
    },
    {
      botId: 'ichiv2-ls-aster-static',
      botName: 'IchiV2 Aster Static',
      botUrl: withDefault(import.meta.env.VITE_ICHIV2_LS_ASTER_STATIC_URL, `${FT_HOST}:9111`),
      sortId: 22,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV2 on Aster (48-pair static).',
    },
    {
      botId: 'ichiv3-ls-aster-static',
      botName: 'IchiV3 Aster Static',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_ASTER_STATIC_URL, `${FT_HOST}:9114`),
      sortId: 23,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV3 on Aster (48-pair static).',
    },
    {
      botId: 'ichiv3-ls-gate-static',
      botName: 'IchiV3 Gate Static',
      botUrl: withDefault(import.meta.env.VITE_ICHIV3_LS_GATE_STATIC_URL, `${FT_HOST}:9116`),
      sortId: 24,
      botType: 'FT',
      description: 'Freqtrade live bot — IchiV3 on Gate (48-pair static).',
    },
    // --- NT vaults (one Freqtrade-compatible api_server per vault) ---
    {
      botId: 'nt-opencz-vault',
      botName: 'NT OpenCZ Vault',
      botUrl: withDefault(import.meta.env.VITE_NT_OPENCZ_URL, `${NT_HOST}:8101`),
      sortId: 30,
      botType: 'NT',
      description: 'Nautilus OpenCZ vault — PavelBreakout, PavelTrend, PavelMeanRev, MeanReversionShort, SigComboDvol.',
    },
    {
      botId: 'nt-contrarian-funding',
      botName: 'NT Contrarian Funding',
      botUrl: withDefault(import.meta.env.VITE_NT_CONTRARIAN_URL, `${NT_HOST}:8111`),
      sortId: 31,
      botType: 'NT',
      description: 'Nautilus Contrarian Funding strategy vault.',
    },
    {
      botId: 'nt-rwa-vault',
      botName: 'NT RWA Vault',
      botUrl: withDefault(import.meta.env.VITE_NT_RWA_URL, `${NT_HOST}:8121`),
      sortId: 32,
      botType: 'NT',
      description: 'Nautilus RWA vault — PivotBreakoutMNQ, MeanRevTradFi.',
    },
    {
      botId: 'nt-weekend-wick',
      botName: 'NT Weekend Wick',
      botUrl: withDefault(import.meta.env.VITE_NT_WEEKEND_WICK_URL, `${NT_HOST}:8131`),
      sortId: 33,
      botType: 'NT',
      description: 'Nautilus Weekend Wick revert strategy vault.',
    },
  ];
}

export function getPresetBotById(botId: string): PresetBotDefinition | undefined {
  return getPresetBots().find((bot) => bot.botId === botId);
}

export function isPresetBotId(botId: string): boolean {
  return getPresetBots().some((bot) => bot.botId === botId);
}
