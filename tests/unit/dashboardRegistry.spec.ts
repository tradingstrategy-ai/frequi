import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('axios', () => ({
  default: { get: axiosMock.get, post: axiosMock.post, isAxiosError: () => false },
}));

const botStoreMock = vi.hoisted(() => ({
  botStores: {} as Record<string, { isSelected: boolean }>,
  availableBots: {} as Record<string, unknown>,
  selectedBot: '',
  addBot: vi.fn(),
  selectFirstBot: vi.fn(),
  allRefreshFull: vi.fn(),
}));
vi.mock('@/stores/ftbotwrapper', () => ({ useBotStore: () => botStoreMock }));

const REGISTRY = {
  allow_writes: false,
  bots: [
    {
      slug: 'gmx',
      display_name: 'GMX AI Vault',
      engine: 'FT',
      api_route: '/api/bots/gmx',
      comparison_id: 'orchestrator_gmx_ai_gmx_vault',
      has_reports: true,
      report_date: '20261014',
      read_only: true,
      dry_run: false,
      connected: true,
    },
    {
      slug: 'bb-revert',
      display_name: 'BB Revert',
      engine: 'NT',
      api_route: '/api/bots/bb-revert',
      comparison_id: null,
      has_reports: true,
      report_date: '20261014',
      read_only: true,
      dry_run: false,
      connected: true,
    },
    {
      slug: 'no-login',
      display_name: 'No Login',
      engine: 'FT',
      api_route: '/api/bots/no-login',
      comparison_id: null,
      has_reports: false,
      report_date: null,
      read_only: true,
      dry_run: true,
      connected: false,
    },
  ],
};

describe('dashboard registry', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    axiosMock.get.mockReset();
    axiosMock.post.mockReset();
    botStoreMock.availableBots = {};
    botStoreMock.botStores = {};
    botStoreMock.selectedBot = 'orchestrator_gmx_ai_gmx_vault';
    botStoreMock.addBot.mockReset();
    botStoreMock.addBot.mockImplementation((bot: { botId: string }) => {
      botStoreMock.availableBots[bot.botId] = bot;
      botStoreMock.botStores[bot.botId] = { isSelected: true };
    });
    botStoreMock.allRefreshFull.mockReset();
  });

  it('builds presets from the gateway registry', async () => {
    axiosMock.get.mockResolvedValue({ data: REGISTRY });
    const { fetchDashboardRegistry } = await import('@/composables/dashboardRegistry');
    const { getPresetBots } = await import('@/config/presetBots');
    await fetchDashboardRegistry();

    const presets = getPresetBots();
    // Central-comparison bots keep their comparison id; the rest use the slug.
    expect(presets.map((p) => p.botId)).toEqual([
      'orchestrator_gmx_ai_gmx_vault',
      'bb-revert',
      'no-login',
    ]);
    expect(presets[1]).toMatchObject({
      botType: 'NT',
      botUrl: '/api/bots/bb-revert',
      readOnly: true,
      slug: 'bb-revert',
    });
    expect(presets[2]?.dryRun).toBe(true);
  });

  it('falls back to the static presets without a gateway', async () => {
    axiosMock.get.mockRejectedValue(new Error('404'));
    const { fetchDashboardRegistry } = await import('@/composables/dashboardRegistry');
    const { getPresetBots, getStaticPresetBots } = await import('@/config/presetBots');

    expect(await fetchDashboardRegistry()).toBeNull();
    expect(getPresetBots()).toEqual(getStaticPresetBots());
  });

  it('treats an HTML fallback page as "no gateway"', async () => {
    axiosMock.get.mockResolvedValue({ data: '<!DOCTYPE html><html></html>' });
    const { fetchDashboardRegistry } = await import('@/composables/dashboardRegistry');
    expect(await fetchDashboardRegistry()).toBeNull();
  });

  it('connects every bot the gateway holds a login for, once', async () => {
    axiosMock.get.mockResolvedValue({ data: REGISTRY });
    axiosMock.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    const { connectRegistryBots } = await import('@/composables/dashboardRegistry');

    // Startup and the login page ask at the same time: one run.
    const [first, second] = await Promise.all([connectRegistryBots(), connectRegistryBots()]);

    expect(first).toEqual(['orchestrator_gmx_ai_gmx_vault', 'bb-revert']);
    expect(second).toEqual(first);
    expect(axiosMock.post).toHaveBeenCalledTimes(2);
    expect(axiosMock.post.mock.calls[0]?.[0]).toBe('/api/bots/gmx/api/v1/token/login');
    expect(botStoreMock.addBot).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: 'bb-revert',
        botUrl: '/api/bots/bb-revert',
        botName: 'BB Revert',
      }),
    );
    expect(botStoreMock.allRefreshFull).toHaveBeenCalledTimes(1);
  });

  it('selects only the active bot for the multi-bot views by default', async () => {
    axiosMock.get.mockResolvedValue({ data: REGISTRY });
    axiosMock.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    const { connectRegistryBots } = await import('@/composables/dashboardRegistry');

    await connectRegistryBots();

    expect(botStoreMock.botStores['orchestrator_gmx_ai_gmx_vault']?.isSelected).toBe(true);
    expect(botStoreMock.botStores['bb-revert']?.isSelected).toBe(false);
  });

  it('restores the selection remembered from the last visit', async () => {
    localStorage.setItem('ftDashboardSelectedBots', JSON.stringify(['bb-revert']));
    axiosMock.get.mockResolvedValue({ data: REGISTRY });
    axiosMock.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    const { connectRegistryBots } = await import('@/composables/dashboardRegistry');

    await connectRegistryBots();

    expect(botStoreMock.botStores['bb-revert']?.isSelected).toBe(true);
    expect(botStoreMock.botStores['orchestrator_gmx_ai_gmx_vault']?.isSelected).toBe(false);
  });

  it('skips bots that are already connected', async () => {
    axiosMock.get.mockResolvedValue({ data: REGISTRY });
    axiosMock.post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r' } });
    botStoreMock.availableBots = { 'bb-revert': {}, orchestrator_gmx_ai_gmx_vault: {} };
    const { connectRegistryBots } = await import('@/composables/dashboardRegistry');

    expect(await connectRegistryBots()).toEqual([]);
    expect(axiosMock.post).not.toHaveBeenCalled();
  });
});
