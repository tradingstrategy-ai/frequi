import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FundingReceivedCard from '@/components/comparison/FundingReceivedCard.vue';
import type { FundingBotRow, FundingResponse } from '@/types';

const api = vi.hoisted(() => ({ fetchFunding: vi.fn() }));
vi.mock('@/composables/comparisonApi', () => api);

const BOT = 'funding_tail_reversal_gmx_standalone';
const stubs = {
  UCard: { template: '<div data-testid="funding-card"><slot /></div>' },
  UBadge: { template: '<span data-testid="funding-state"><slot /></span>' },
  UIcon: { template: '<i />' },
  UAlert: {
    props: ['title', 'description'],
    template: '<div class="alert"><b>{{ title }}</b> <i>{{ description }}</i></div>',
  },
};

function respond(row: Partial<FundingBotRow>, schema = '1'): FundingResponse {
  return {
    schema_version: schema,
    bots: [
      {
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
          last_claim_at_utc: null,
        },
        ...row,
      },
    ],
  };
}

async function render(botId = BOT) {
  const wrapper = mount(FundingReceivedCard, { props: { botId }, global: { stubs } });
  await flushPromises();
  return wrapper;
}

describe('FundingReceivedCard', () => {
  beforeEach(() => api.fetchFunding.mockReset());

  it('shows the verified total with its as-of time and the separate-from-profit note', async () => {
    api.fetchFunding.mockResolvedValue(respond({}));
    const wrapper = await render();
    expect(wrapper.get('[data-testid="funding-total"]').text()).toBe('$12.00');
    expect(wrapper.get('[data-testid="funding-as-of"]').text()).toBe('as of 2026-10-16 09:00 UTC');
    expect(wrapper.get('[data-testid="funding-state"]').text()).toBe('Verified');
    expect(wrapper.get('[data-testid="funding-breakdown"]').text()).toContain('Claimed: $8.00');
    expect(wrapper.text()).toContain('not part of Total Profit');
  });

  it('keeps the number and adds a stale warning when stale', async () => {
    api.fetchFunding.mockResolvedValue(
      respond({ status: 'stale', reason: 'sampled 52h ago', as_of: '2026-10-14T05:00:00+00:00' }),
    );
    const wrapper = await render();
    expect(wrapper.get('[data-testid="funding-total"]').text()).toBe('$12.00');
    expect(wrapper.get('[data-testid="funding-as-of"]').text()).toContain('2026-10-14 05:00 UTC');
    expect(wrapper.get('[data-testid="funding-stale"]').text()).toContain('sampled 52h ago');
    expect(wrapper.get('[data-testid="funding-state"]').text()).toBe('Stale');
  });

  it('shows the reason and no dollar amount for an invalid file', async () => {
    api.fetchFunding.mockResolvedValue(
      respond({ status: 'invalid', reason: 'funding file does not match its recorded SHA-256' }),
    );
    const wrapper = await render();
    expect(wrapper.find('[data-testid="funding-total"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="funding-no-number"]').text()).toContain('SHA-256');
    // Only the static caveat may mention money; no amount is rendered anywhere.
    expect(wrapper.text()).not.toMatch(/\$\d/);
  });

  it('shows a neutral state when nothing has been fetched yet', async () => {
    api.fetchFunding.mockResolvedValue(
      respond({
        status: 'unavailable',
        reason: 'no funding file has been fetched yet',
        as_of: null,
        funding: null,
      }),
    );
    const wrapper = await render();
    expect(wrapper.get('[data-testid="funding-state"]').text()).toBe('No data');
    expect(wrapper.get('[data-testid="funding-no-number"]').text()).toContain(
      'No funding data yet',
    );
  });

  it('treats an unknown schema version as unavailable, without throwing', async () => {
    api.fetchFunding.mockResolvedValue(respond({}, '2'));
    const wrapper = await render();
    expect(wrapper.find('[data-testid="funding-total"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="funding-state"]').text()).toBe('No data');
  });

  it('makes no request and renders nothing for any other bot', async () => {
    const wrapper = await render('orchestrator_gmx_ai_gmx_vault');
    expect(api.fetchFunding).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="funding-card"]').exists()).toBe(false);
  });

  it('renders nothing when the backend does not list the bot', async () => {
    api.fetchFunding.mockResolvedValue({ schema_version: '1', bots: [] });
    const wrapper = await render();
    expect(wrapper.find('[data-testid="funding-card"]').exists()).toBe(false);
  });

  it('shows a load error, never a number, when loading failed', async () => {
    api.fetchFunding.mockResolvedValue(respond({}));
    const util = await import('@/utils/fundingView');
    const spy = vi
      .spyOn(util, 'loadFundingView')
      .mockResolvedValue({ view: null, error: 'Funding data could not be loaded.' });
    const wrapper = await render();
    spy.mockRestore();
    expect(wrapper.get('[data-testid="funding-load-error"]').text()).toContain(
      'could not be loaded',
    );
    expect(wrapper.find('[data-testid="funding-total"]').exists()).toBe(false);
  });
});
