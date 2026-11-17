import { BOT_PROXY_PATH_PREFIX } from '@/utils/botAuthorization';

/** Bot names are interpolated into a URL path, so only simple slugs are accepted. */
const BOT_ROUTE_NAME = /^[a-z0-9_-]+$/;

/**
 * Parse a build-time `key=bot,key=bot` list into a key -> same-origin route map.
 *
 * Hostnames and ports of the deployment live in the build environment rather than
 * the source, so the public repository carries no infrastructure details. An
 * unset or empty value disables the rewrite. Malformed entries are skipped with a
 * console warning so a typo in the build env is visible.
 *
 * @param raw Value of the `VITE_KNOWN_BOT_*` variable, e.g. `9098=gmx,9109=apex`.
 * @param lowerCaseKeys Lower-case the keys, for hostnames.
 */
export function parseBotRouteMap(
  raw: string | undefined,
  lowerCaseKeys = false,
): Readonly<Record<string, string>> {
  const routes: Record<string, string> = {};
  for (const entry of (raw ?? '').split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') {
      continue;
    }
    const [key, bot, ...rest] = trimmed.split('=').map((part) => part.trim());
    if (!key || !bot || rest.length > 0 || !BOT_ROUTE_NAME.test(bot)) {
      console.warn('Ignoring malformed known-bot route entry in the build environment.');
      continue;
    }
    routes[lowerCaseKeys ? key.toLowerCase() : key] = `${BOT_PROXY_PATH_PREFIX}${bot}`;
  }
  return routes;
}

/**
 * Public hostnames that serve the production bots, mapped to the same-origin
 * route that reaches the same bot through this dashboard. Set at build time via
 * `VITE_KNOWN_BOT_HOSTNAMES` (`hostname=bot,...`).
 *
 * A browser login to one of these hostnames is cross-origin and fails on the
 * bot's CORS policy, which is deliberately left unchanged.
 */
const botHostnameRoutes = (): Readonly<Record<string, string>> =>
  parseBotRouteMap(import.meta.env.VITE_KNOWN_BOT_HOSTNAMES, true);

/**
 * Host ports the production bots publish on the machine that serves the
 * dashboard, mapped to their same-origin route. Set at build time via
 * `VITE_KNOWN_BOT_PORTS` (`port=bot,...`). Only applied when the typed host is
 * the dashboard's own host.
 */
const botPortRoutes = (): Readonly<Record<string, string>> =>
  parseBotRouteMap(import.meta.env.VITE_KNOWN_BOT_PORTS);

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
  const byHostname = botHostnameRoutes()[parsed.hostname.toLowerCase()];
  if (byHostname !== undefined) {
    return byHostname;
  }
  if (parsed.port !== '' && parsed.hostname.toLowerCase() === dashboardHostname.toLowerCase()) {
    return botPortRoutes()[parsed.port];
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
