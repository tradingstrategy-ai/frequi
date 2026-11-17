import axios from 'axios';

/**
 * One bot in the dashboard gateway's registry (`GET /api/bots/_registry`).
 *
 * The gateway (orchestrator `scripts/dashboard_gateway`) fronts every Freqtrade and
 * Nautilus bot at `/api/bots/<slug>` and holds their logins server-side, so FreqUI
 * can connect them all without asking for per-bot passwords.
 */
export interface RegistryBot {
  slug: string;
  display_name: string;
  engine: 'FT' | 'NT';
  api_route: string;
  /** Bot id in the central comparison API, when the bot has a central bundle. */
  comparison_id: string | null;
  /** Whether the bot publishes fleet live-vs-backtest HTML reports. */
  has_reports: boolean;
  report_date: string | null;
  read_only: boolean;
  dry_run: boolean;
  /** Whether the gateway holds a login for this bot. */
  connected: boolean;
}

export interface DashboardRegistry {
  bots: RegistryBot[];
  allow_writes: boolean;
}

export const REGISTRY_URL = '/api/bots/_registry';

/** First sortId used for registry bots, after any manually added bots. */
const REGISTRY_SORT_BASE = 100;

const registry = ref<DashboardRegistry | null>(null);
const registryLoaded = ref(false);
const connecting = ref(false);
let inflight: Promise<DashboardRegistry | null> | null = null;
let connectInflight: Promise<string[]> | null = null;

/**
 * FreqUI bot id for a registry bot.
 *
 * Central-comparison bots keep their comparison `bot_id` (the candle chart's
 * "Show BT trades" overlay matches on it); every other bot uses its slug.
 */
export function registryBotId(bot: RegistryBot): string {
  return bot.comparison_id ?? bot.slug;
}

/**
 * Load the gateway registry once. Resolves to `null` when the dashboard is served
 * without a gateway (production `:9198` today), so callers fall back to the
 * hardcoded presets.
 */
export function fetchDashboardRegistry(force = false): Promise<DashboardRegistry | null> {
  if (registryLoaded.value && !force) {
    return Promise.resolve(registry.value);
  }
  if (inflight) {
    return inflight;
  }
  inflight = axios
    .get<DashboardRegistry>(REGISTRY_URL, { withCredentials: true })
    .then(({ data }) => (data && Array.isArray(data.bots) ? data : null))
    .catch(() => null)
    .then((value) => {
      registry.value = value;
      registryLoaded.value = true;
      inflight = null;
      return value;
    });
  return inflight;
}

/** Registry bot for a FreqUI bot id, if any. */
export function findRegistryBot(botId: string): RegistryBot | undefined {
  return registry.value?.bots.find((bot) => registryBotId(bot) === botId);
}

/** localStorage key holding the bots ticked for the multi-bot views. */
const SELECTION_KEY = 'ftDashboardSelectedBots';

let selectionPersisted = false;

/**
 * Which gateway bots feed the multi-bot Dashboard.
 *
 * FreqUI selects every bot by default, which was fine for five bots. With dozens the
 * Dashboard concatenates, sorts and charts every trade of every bot on each refresh and
 * the browser stops responding. Gateway bots therefore start unselected except the one
 * on screen (or the selection remembered from the last visit); tick more in the "Bot
 * comparison" list. The selection is saved as it changes.
 */
/** The bots ticked on the last visit ([] when none was saved). */
export function rememberedSelection(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SELECTION_KEY) ?? 'null');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Whether a bot starts ticked when it is added (restored on a reload or connected): the
 * selection remembered from the last visit plus the bot on screen. Without a remembered
 * selection FreqUI's default (ticked) applies, as before the dashboard registry existed.
 */
export function startsSelected(botId: string, selectedBot: string): boolean {
  const saved = rememberedSelection();
  return saved.length === 0 || saved.includes(botId) || botId === selectedBot;
}

function applyRegistrySelection(ids: string[]) {
  const botStore = useBotStore();
  const saved = rememberedSelection();
  const wanted = new Set(saved.length > 0 ? saved : [botStore.selectedBot]);
  ids.forEach((id) => {
    const sub = botStore.botStores[id];
    if (sub) sub.isSelected = wanted.has(id);
  });
  if (!selectionPersisted) {
    selectionPersisted = true;
    watch(
      () =>
        Object.entries(botStore.botStores)
          .filter(([, sub]) => sub.isSelected)
          .map(([id]) => id)
          .sort()
          .join('|'),
      (joined) =>
        localStorage.setItem(SELECTION_KEY, JSON.stringify(joined ? joined.split('|') : [])),
    );
  }
}

/**
 * Connect every registry bot that is not connected yet.
 *
 * The gateway ignores the login sent here (the site's own login already
 * authenticated the operator) and answers with a dashboard token, so this needs no
 * per-bot credentials.
 *
 * @returns the bot ids that were newly connected.
 */
export function connectRegistryBots(): Promise<string[]> {
  // Concurrent callers (startup and the login page) share one run.
  connectInflight ??= connectMissingBots().finally(() => {
    connectInflight = null;
  });
  return connectInflight;
}

async function connectMissingBots(): Promise<string[]> {
  const loaded = await fetchDashboardRegistry();
  if (!loaded) {
    return [];
  }
  const botStore = useBotStore();
  connecting.value = true;
  const added: string[] = [];
  try {
    for (const [index, bot] of loaded.bots.entries()) {
      const botId = registryBotId(bot);
      if (!bot.connected || botId in botStore.availableBots) {
        continue;
      }
      try {
        const { login } = useLoginInfo(botId);
        await login({
          botName: bot.display_name,
          url: bot.api_route,
          username: 'dashboard',
          password: 'dashboard',
        });
        botStore.addBot({
          botId,
          botName: bot.display_name,
          botUrl: bot.api_route,
          sortId: REGISTRY_SORT_BASE + index,
        });
        // Polled in the background until the selection below is applied (dozens of bots).
        const sub = botStore.botStores[botId];
        if (sub) sub.isSelected = botId === botStore.selectedBot;
        added.push(botId);
      } catch (error) {
        console.error(`Could not connect ${bot.slug}`, error);
      }
    }
    if (
      added.length > 0 &&
      (!botStore.selectedBot || !(botStore.selectedBot in botStore.availableBots))
    ) {
      botStore.selectFirstBot();
    }
    // Every page load, not only when a bot was added: after a reload all bots are restored
    // from storage ticked, and nothing would untick them (all 32 polled at full rate).
    applyRegistrySelection(loaded.bots.map(registryBotId).filter((id) => id in botStore.botStores));
    if (added.length > 0) {
      botStore.allRefreshFull();
    }
  } finally {
    connecting.value = false;
  }
  return added;
}

export function useDashboardRegistry() {
  return {
    registry: readonly(registry),
    registryLoaded: readonly(registryLoaded),
    connecting: readonly(connecting),
    fetchDashboardRegistry,
    connectRegistryBots,
    findRegistryBot,
    registryBotId,
  };
}
