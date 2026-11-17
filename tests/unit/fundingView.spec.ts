import { describe, expect, it } from 'vitest';

import type { FundingBotRow, FundingResponse } from '@/types';
import {
  buildFundingView,
  formatAsOf,
  formatUsd,
  FUNDING_BOT_IDS,
  fundingBotForRequest,
  loadFundingView,
  SUPPORTED_FUNDING_SCHEMA,
} from '@/utils/fundingView';

const BOT = 'funding_tail_reversal_gmx_standalone';

function row(overrides: Partial<FundingBotRow> = {}): FundingBotRow {
  return {
    bot_id: BOT,
    status: 'ok',
    reason: null,
    as_of: '2026-10-16T09:00:00+00:00',
    funding: {
      claimed_usd: 8,
      settled_usd: 2,
      pending_usd: 2,
      total_received_usd: 12,
      unpriced_count: 0,
      claim_count: 2,
      last_claim_at_utc: '2026-10-15T01:00:00+00:00',
    },
    ...overrides,
  };
}

function response(rows: FundingBotRow[], schema = SUPPORTED_FUNDING_SCHEMA): FundingResponse {
  return { schema_version: schema, bots: rows };
}

describe('fundingView', () => {
  it('shows the verified total with its sample time and a breakdown', () => {
    const view = buildFundingView(response([row()]), BOT);
    expect(view).toMatchObject({
      state: 'ok',
      headline: '$12.00',
      asOf: '2026-10-16 09:00 UTC',
      reason: null,
      note: null,
    });
    expect(view?.breakdown).toEqual([
      { label: 'Claimed', value: '$8.00' },
      { label: 'Claimable now', value: '$2.00' },
      { label: 'Accruing on open positions', value: '$2.00' },
    ]);
  });

  it('keeps sub-dollar amounts visible', () => {
    expect(formatUsd(0.0475)).toBe('$0.0475');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0)).toBe('$0.0000');
  });

  it('keeps the figure and its real sample time when stale', () => {
    const view = buildFundingView(
      response([
        row({ status: 'stale', reason: 'sampled 52h ago', as_of: '2026-10-14T05:00:00+00:00' }),
      ]),
      BOT,
    );
    expect(view).toMatchObject({
      state: 'stale',
      headline: '$12.00',
      asOf: '2026-10-14 05:00 UTC',
      reason: 'sampled 52h ago',
    });
  });

  it('notes balances the backend could not price', () => {
    const one = row();
    one.funding = { ...one.funding!, unpriced_count: 1 };
    expect(buildFundingView(response([one]), BOT)?.note).toBe(
      '1 balance could not be priced and is not in this total.',
    );
    const two = row();
    two.funding = { ...two.funding!, unpriced_count: 3 };
    expect(buildFundingView(response([two]), BOT)?.note).toContain(
      '3 balances could not be priced and are',
    );
  });

  it('renders nothing for a bot the backend does not list, or a missing response', () => {
    expect(buildFundingView(response([]), BOT)).toBeNull();
    expect(buildFundingView(response([row({ bot_id: 'other' })]), BOT)).toBeNull();
    expect(buildFundingView(null, BOT)).toBeNull();
    expect(buildFundingView({ schema_version: '1' } as unknown as FundingResponse, BOT)).toBeNull();
  });

  it('shows no number when nothing has been fetched', () => {
    const view = buildFundingView(
      response([
        row({
          status: 'unavailable',
          reason: 'no funding file has been fetched yet',
          as_of: null,
          funding: null,
        }),
      ]),
      BOT,
    );
    expect(view).toMatchObject({ state: 'unavailable', headline: null, asOf: null });
    expect(view?.reason).toBe('no funding file has been fetched yet');
  });

  it('never shows a number for an invalid file, even if the payload carries one', () => {
    const view = buildFundingView(
      response([
        row({ status: 'invalid', reason: 'funding file does not match its recorded SHA-256' }),
      ]),
      BOT,
    );
    expect(view).toMatchObject({ state: 'invalid', headline: null, asOf: null, breakdown: [] });
    expect(JSON.stringify(view)).not.toContain('$');
  });

  it('treats an unknown schema version as unavailable', () => {
    const view = buildFundingView(response([row()], '2'), BOT);
    expect(view).toMatchObject({ state: 'unavailable', headline: null });
  });

  it('treats an unknown status as unavailable', () => {
    const view = buildFundingView(response([row({ status: 'weird' as never })]), BOT);
    expect(view).toMatchObject({ state: 'unavailable', headline: null });
  });

  it('refuses to show a figure without a usable sample time or amounts', () => {
    for (const broken of [
      row({ as_of: null }),
      row({ as_of: 'not a date' }),
      row({ funding: null }),
      row({ funding: { total_received_usd: Number.NaN } as never }),
    ]) {
      const view = buildFundingView(response([broken]), BOT);
      expect(view).toMatchObject({ state: 'invalid', headline: null, asOf: null });
    }
  });

  it('formats the sample time in UTC and rejects garbage', () => {
    expect(formatAsOf('2026-10-16T11:00:00+02:00')).toBe('2026-10-16 09:00 UTC');
    expect(formatAsOf('')).toBeNull();
    expect(formatAsOf(null)).toBeNull();
    expect(formatAsOf('nope')).toBeNull();
  });

  it('only the funding-tail bot is gated in', () => {
    expect(FUNDING_BOT_IDS).toEqual([BOT]);
  });

  it('loads and interprets a response', async () => {
    const load = await loadFundingView(BOT, async () => response([row()]));
    expect(load.error).toBe('');
    expect(load.view?.headline).toBe('$12.00');
  });

  it('turns a 404 into an unavailable view, not an error', async () => {
    const load = await loadFundingView(BOT, async () => {
      throw Object.assign(new Error('not found'), { response: { status: 404 } });
    });
    expect(load.error).toBe('');
    expect(load.view).toMatchObject({ state: 'unavailable', headline: null });
    expect(load.view?.reason).toContain('not deployed');
  });

  it('turns any other failure into an error with no view and no number', async () => {
    for (const failure of [
      new Error('network down'),
      { response: { status: 500 } },
      'weird',
      null,
    ]) {
      const load = await loadFundingView(BOT, async () => {
        throw failure;
      });
      expect(load).toEqual({ view: null, error: 'Funding data could not be loaded.' });
    }
  });

  it('returns no view when the backend does not list the bot', async () => {
    expect(await loadFundingView(BOT, async () => response([]))).toEqual({ view: null, error: '' });
  });

  it('holds the card while the active bot is not the one the URL asked for', () => {
    // Cold load: the store first selects a persisted or first-listed bot, then applies ?bot=.
    expect(fundingBotForRequest('orchestrator_gmx_ai_gmx_vault', BOT)).toBe('');
    expect(fundingBotForRequest(BOT, 'orchestrator_gmx_ai_gmx_vault')).toBe('');
    expect(fundingBotForRequest(BOT, '')).toBe('');
  });

  it('lets the card act once the active bot matches, or when the URL names no bot', () => {
    expect(fundingBotForRequest(BOT, BOT)).toBe(BOT);
    expect(fundingBotForRequest(undefined, BOT)).toBe(BOT);
    expect(fundingBotForRequest(null, BOT)).toBe(BOT);
    expect(fundingBotForRequest('', BOT)).toBe(BOT);
  });

  it('never turns the held id into a funding request', () => {
    expect(FUNDING_BOT_IDS).not.toContain(fundingBotForRequest('other', BOT));
  });
});
