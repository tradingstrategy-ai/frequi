import { BOT_PROXY_PATH_PREFIX } from '@/utils/botAuthorization';

/**
 * Public hostnames Caddy serves for the production bots, mapped to the
 * same-origin route that reaches the same bot through this dashboard.
 *
 * A browser login to one of these hostnames is cross-origin and fails on the
 * bot's CORS policy, which is deliberately left unchanged.
 */
const BOT_HOSTNAME_ROUTES: Readonly<Record<string, string>> = {
  'pavel-multistrategy-gmx.tradingstrategy.ai': `${BOT_PROXY_PATH_PREFIX}gmx`,
  'apex-multistrategy.tradingstrategy.ai': `${BOT_PROXY_PATH_PREFIX}apex`,
};

/**
 * Host ports the production bots publish on the machine that serves the
 * dashboard, mapped to their same-origin route. Only applied when the typed
 * host is the dashboard's own host.
 */
const BOT_PORT_ROUTES: Readonly<Record<string, string>> = {
  '9098': `${BOT_PROXY_PATH_PREFIX}gmx`,
  '9109': `${BOT_PROXY_PATH_PREFIX}apex`,
  '9110': `${BOT_PROXY_PATH_PREFIX}dipbuyer`,
  '8101': `${BOT_PROXY_PATH_PREFIX}derive`,
  '8114': `${BOT_PROXY_PATH_PREFIX}derive`,
};

function parseBotUrl(botApiUrl: string): URL | undefined {
  const trimmed = botApiUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }
  try {
    return new URL(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Return the same-origin proxy route for a direct address of a known production
 * bot, or `undefined` when the URL is not one of them.
 *
 * Only a bare base URL is rewritten: a URL that already carries a path is left
 * alone so a deliberate custom address is never silently redirected.
 *
 * @param botApiUrl URL typed into the bot login form.
 * @param dashboardHostname Hostname the dashboard itself is served from.
 */
export function findProxiedBotRoute(
  botApiUrl: string | null | undefined,
  dashboardHostname: string = window.location.hostname,
): string | undefined {
  if (!botApiUrl) {
    return undefined;
  }
  const parsed = parseBotUrl(botApiUrl);
  if (parsed === undefined || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    return undefined;
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return undefined;
  }
  const byHostname = BOT_HOSTNAME_ROUTES[parsed.hostname.toLowerCase()];
  if (byHostname !== undefined) {
    return byHostname;
  }
  if (parsed.port !== '' && parsed.hostname.toLowerCase() === dashboardHostname.toLowerCase()) {
    return BOT_PORT_ROUTES[parsed.port];
  }
  return undefined;
}

/** Rewrite a known direct bot address to its proxy route; return other URLs unchanged. */
export function toProxiedBotUrl(
  botApiUrl: string,
  dashboardHostname: string = window.location.hostname,
): string {
  return findProxiedBotRoute(botApiUrl, dashboardHostname) ?? botApiUrl;
}
