/**
 * Set when Caddy's reports gate rejects a bot API call.
 *
 * The bot credentials are untouched in that case - only the browser-managed
 * reports BasicAuth is missing - so the UI offers a reconnect action instead of
 * logging the bot out. Shared across bots because the gate is per-origin.
 */
const reportsAuthRequired = ref(false);

export function requireReportsAuth(): void {
  reportsAuthRequired.value = true;
}

export function clearReportsAuthRequirement(): void {
  if (reportsAuthRequired.value) {
    reportsAuthRequired.value = false;
  }
}

export { reportsAuthRequired };
