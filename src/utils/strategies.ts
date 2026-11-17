/**
 * Strategy names in a multi-strategy Nautilus bot.
 *
 * A live trade names its strategy by class (`IchiV4Short`, or `BBRevertLS-008` with the
 * instance suffix), the daily reports by selector id (`ichiv4_short`). Every spelling is
 * reduced to one key so a trade, a report and a recorded indicator column can be matched.
 */

/**
 * Names a live strategy still carries after its report was renamed.
 *
 * A locked strategy keeps its live `strategy_id` pin, so trades of `SigComboExp47` belong
 * to the `SigComboDvol` report. Mirrors the gateway's `STRATEGY_ALIASES`.
 */
const STRATEGY_ALIASES: Record<string, string> = { sigcomboexp47: 'sigcombodvol' };

/** The key every spelling of a strategy name shares (lower-case alphanumerics, no instance suffix). */
export function normalizeStrategy(name: string | null | undefined): string {
  const reduced = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/-\d+$/, '')
    .replace(/[^a-z0-9]/g, '');
  return STRATEGY_ALIASES[reduced] ?? reduced;
}

/** Whether a trade's (or column's) strategy name belongs to the strategy `key` (a normalised key). */
export function matchesStrategy(name: string | null | undefined, key: string): boolean {
  return !key || normalizeStrategy(name) === key;
}
