import type { FundingAmounts, FundingBotRow, FundingResponse, FundingStatus } from '@/types';

/** Bots with a funding figure; every other bot's page makes no funding request. */
export const FUNDING_BOT_IDS: readonly string[] = ['funding_tail_reversal_gmx_standalone'];

/**
 * The bot the funding card may act on.
 *
 * On a cold load the comparison store selects a bot (a persisted one, or the first listed) before the
 * layout applies the `?bot=` the URL asked for, so for a moment the active bot is not the requested one.
 * Acting on that transient bot would fire a funding request for a bot the user never opened. Hold (an
 * empty id, which no funding bot has) until the two agree.
 *
 * @param requestedBotId the `bot` query parameter, if any
 * @param activeBotId the store's active bot
 */
export function fundingBotForRequest(
  requestedBotId: string | null | undefined,
  activeBotId: string,
): string {
  if (requestedBotId && requestedBotId !== activeBotId) return '';
  return activeBotId;
}

/** Funding API schema this view understands. */
export const SUPPORTED_FUNDING_SCHEMA = '1';

export interface FundingBreakdownItem {
  label: string;
  value: string;
}

export interface FundingView {
  /** `unavailable` also covers an unknown API version, an unknown status and a missing endpoint. */
  state: FundingStatus;
  /** Formatted total; `null` unless the backend verified the data (`ok` or `stale`). */
  headline: string | null;
  /** UTC sample time of the figure, always present together with a headline. */
  asOf: string | null;
  reason: string | null;
  breakdown: FundingBreakdownItem[];
  note: string | null;
}

const NO_NUMBER: Pick<FundingView, 'headline' | 'asOf' | 'breakdown' | 'note'> = {
  headline: null,
  asOf: null,
  breakdown: [],
  note: null,
};

/** Format a USD amount; sub-dollar amounts keep 4 decimals so a few cents stay visible. */
export function formatUsd(value: number): string {
  const digits = Math.abs(value) < 1 ? 4 : 2;
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Render an ISO-8601 instant as `YYYY-MM-DD HH:mm UTC`; `null` when it cannot be parsed. */
export function formatAsOf(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function isAmounts(value: unknown): value is FundingAmounts {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return [
    'claimed_usd',
    'settled_usd',
    'pending_usd',
    'total_received_usd',
    'unpriced_count',
  ].every((key) => typeof row[key] === 'number' && Number.isFinite(row[key]));
}

function unpricedNote(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 balance could not be priced and is not in this total.'
    : `${count} balances could not be priced and are not in this total.`;
}

function withoutNumber(state: FundingStatus, reason: string | null): FundingView {
  return { ...NO_NUMBER, state, reason };
}

function viewOfRow(row: FundingBotRow): FundingView {
  if (row.status === 'unavailable') {
    return withoutNumber('unavailable', row.reason ?? 'No funding data yet.');
  }
  if (row.status === 'invalid') {
    // The backend withholds numbers for an invalid file; never show one even if a payload carries it.
    return withoutNumber('invalid', row.reason ?? 'The funding data failed verification.');
  }
  if (row.status !== 'ok' && row.status !== 'stale') {
    return withoutNumber(
      'unavailable',
      'The funding API returned a status this page does not know.',
    );
  }
  const asOf = formatAsOf(row.as_of);
  if (!isAmounts(row.funding) || asOf === null) {
    // A figure is only ever shown together with its sample time.
    return withoutNumber('invalid', 'The funding response is incomplete, so no figure is shown.');
  }
  const amounts = row.funding;
  return {
    state: row.status,
    headline: formatUsd(amounts.total_received_usd),
    asOf,
    reason: row.status === 'stale' ? (row.reason ?? 'This figure is older than expected.') : null,
    breakdown: [
      { label: 'Claimed', value: formatUsd(amounts.claimed_usd) },
      { label: 'Claimable now', value: formatUsd(amounts.settled_usd) },
      { label: 'Accruing on open positions', value: formatUsd(amounts.pending_usd) },
    ],
    note: unpricedNote(amounts.unpriced_count),
  };
}

/**
 * Build the funding card for one bot from the `/funding` response.
 *
 * @returns `null` when the card should not render: a bot the backend does not list.
 */
export function buildFundingView(
  response: FundingResponse | null | undefined,
  botId: string,
): FundingView | null {
  if (!response || !Array.isArray(response.bots)) return null;
  const row = response.bots.find((bot) => bot.bot_id === botId);
  if (!row) return null;
  if (response.schema_version !== SUPPORTED_FUNDING_SCHEMA) {
    return withoutNumber('unavailable', 'The funding API version is not supported by this page.');
  }
  return viewOfRow(row);
}

export interface FundingLoad {
  /** `null` when the card should not render, or when loading failed (see `error`). */
  view: FundingView | null;
  /** Non-empty only when the request failed for a reason other than a missing endpoint. */
  error: string;
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Fetch and interpret the funding response for one bot. Never throws: a missing endpoint (404)
 * becomes an `unavailable` view, any other failure becomes an `error` and never a number.
 */
export async function loadFundingView(
  botId: string,
  fetcher: () => Promise<FundingResponse>,
): Promise<FundingLoad> {
  try {
    return { view: buildFundingView(await fetcher(), botId), error: '' };
  } catch (error) {
    if (httpStatus(error) === 404) {
      return {
        view: withoutNumber(
          'unavailable',
          'The funding endpoint is not deployed on this backend yet.',
        ),
        error: '',
      };
    }
    return { view: null, error: 'Funding data could not be loaded.' };
  }
}
