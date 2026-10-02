export type BotAuthorizationHeaderName = 'Authorization' | 'X-Bot-Authorization';

/** Same-origin path prefix Caddy exposes the reports-protected bot APIs under. */
export const BOT_PROXY_PATH_PREFIX = '/api/bots/';
/** Header Caddy rewrites into the upstream Authorization before proxying. */
export const BOT_AUTHORIZATION_HEADER = 'X-Bot-Authorization';
/** Reports-BasicAuth preflight: 204 when authenticated, 401 Basic challenge when not. */
export const REPORTS_AUTH_CHECK_URL = `${BOT_PROXY_PATH_PREFIX}auth-check`;
/** Top-level route that establishes reports BasicAuth and redirects back into the UI. */
export const REPORTS_AUTH_BOOTSTRAP_URL = `${BOT_PROXY_PATH_PREFIX}auth-bootstrap`;
/**
 * Realm Caddy sends on its own 401. freqtrade serves /api/v1/token/login behind
 * FastAPI HTTPBasic, whose 401 also carries a `Basic` challenge, so the realm is
 * what separates "reports auth missing" from "wrong bot credentials".
 */
export const REPORTS_AUTH_REALM = 'restricted';

/**
 * True when the URL resolves to a bot API behind this origin's reports proxy.
 *
 * Resolving through `URL` rather than matching the raw string keeps the absolute
 * form a user copies out of the address bar on the proxy routing: sending the bot
 * credentials as `Authorization` there would clobber the reports BasicAuth that
 * Caddy validates.
 */
export function isProxiedBotUrl(botApiUrl: string | null | undefined): boolean {
  if (!botApiUrl) {
    return false;
  }
  try {
    const resolved = new URL(botApiUrl, window.location.origin);
    return (
      resolved.origin === window.location.origin &&
      resolved.pathname.startsWith(BOT_PROXY_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

/** Return the header name that carries the bot's own credentials. */
export function getBotAuthorizationHeaderName(
  botApiUrl: string | null | undefined,
): BotAuthorizationHeaderName {
  return isProxiedBotUrl(botApiUrl) ? BOT_AUTHORIZATION_HEADER : 'Authorization';
}

/** Encode a bot's HTTP Basic credentials without using Authorization on Caddy routes. */
export function encodeBasicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const bag = headers as Record<string, unknown> & {
    get?: (headerName: string) => unknown;
  };
  if (typeof bag.get === 'function') {
    const viaGetter = bag.get(name);
    if (typeof viaGetter === 'string') {
      return viaGetter;
    }
  }
  const match = Object.keys(bag).find((key) => key.toLowerCase() === name);
  const value = match === undefined ? undefined : bag[match];
  return typeof value === 'string' ? value : undefined;
}

/**
 * True when a 401 came from Caddy's reports gate rather than from the bot.
 *
 * Only the reports realm may skip the token refresh: refreshing cannot fix a
 * missing reports credential, and the refresh 401 would otherwise be read as an
 * expired refresh token and wipe a bot session that is still perfectly valid.
 */
export function isReportsAuthChallenge(headers: unknown): boolean {
  const challenge = readHeader(headers, 'www-authenticate');
  if (!challenge) {
    return false;
  }
  const normalized = challenge.trim();
  if (!/^basic(\s|$)/i.test(normalized)) {
    return false;
  }
  // Caddy may or may not quote the realm.
  const realm = /realm\s*=\s*(?:"([^"]*)"|([^\s,]+))/i.exec(normalized);
  return (realm?.[1] ?? realm?.[2])?.toLowerCase() === REPORTS_AUTH_REALM;
}
