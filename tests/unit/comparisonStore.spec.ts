import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

const apiMocks = vi.hoisted(() => ({
  fetchComparisonBots: vi.fn(),
  fetchOverview: vi.fn(),
  fetchTimeline: vi.fn(),
  fetchPairs: vi.fn(),
  fetchTrades: vi.fn(),
  fetchComparisonCandles: vi.fn(),
}));

vi.mock('@/composables/useToast', () => ({ useToast: () => ({ add: vi.fn() }) }));
vi.mock('@/composables/comparisonApi', () => ({ ...apiMocks }));

import { useComparisonStore } from '@/stores/comparisonStore';

const createdStores: ReturnType<typeof useComparisonStore>[] = [];
function useTrackedComparisonStore() {
  const store = useComparisonStore();
  createdStores.push(store);
  return store;
}

const report = (snapshot_id: string, status = 'READY') => ({
  schema_version: '1', snapshot_id, status, reason: null, generated_at: '2026-09-29T12:00:00Z',
  report_date: '2026-09-29', report_window: { start: '2026-09-01', end: '2026-09-29' },
  stale: false, source_artifacts: [], unavailable_fields: [], annotations: [],
});

const bot = (snapshotId: string, status = 'READY') => ({
  bot_id: 'derive-report', bot_type: 'NT' as const, display_name: 'Derive report',
  venue: 'Derive', sleeves: ['core', 'hedged'], is_vault: false, report: report(snapshotId, status),
});

const overview = (snapshotId: string) => ({
  live_metrics: {}, bt_metrics: {}, equity_curve: { live: [], bt: [] },
  match_summary: {}, daily_profit: [], monthly_heatmap: [], report: report(snapshotId),
});

function setupPinia() {
  const pinia = createPinia().use(piniaPluginPersistedstate);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return pinia;
}

describe('comparisonStore', () => {
  beforeEach(() => {
    createdStores.length = 0;
    localStorage.clear();
    setupPinia();
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    createdStores.forEach((store) => store.$dispose());
    localStorage.clear();
  });

  it('keeps report selection and sleeve independent of Freqtrade login selection and persists them', async () => {
    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [bot('snapshot-1')] });
    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    store.setSelectedBot('derive-report');
    store.setSelectedSleeve('hedged');
    // pinia-plugin-persistedstate writes through its watcher on Vue's next tick.
    await nextTick();

    expect(store.activeBotId).toBe('derive-report');
    expect(store.selectedSleeve).toBe('hedged');
    expect(localStorage.getItem('ftUIComparisonSettings')).toContain('derive-report');
    expect(localStorage.getItem('ftUIComparisonSettings')).toContain('hedged');

    // A new store instance hydrates the picker selection separately from bot-login state.
    const nextPinia = createPinia().use(piniaPluginPersistedstate);
    createApp({}).use(nextPinia);
    setActivePinia(nextPinia);
    const restored = useTrackedComparisonStore();
    expect(restored.selectedBotId).toBe('derive-report');
    expect(restored.selectedSleeve).toBe('hedged');
  });

  it('shares an in-flight catalog request between layout and page mounting', async () => {
    let resolveCatalog!: (value: { bots: ReturnType<typeof bot>[] }) => void;
    apiMocks.fetchComparisonBots.mockReturnValue(new Promise((resolve) => {
      resolveCatalog = resolve;
    }));
    const store = useTrackedComparisonStore();

    const layoutLoad = store.ensureComparisonBots();
    const pageLoad = store.ensureComparisonBots();
    expect(apiMocks.fetchComparisonBots).toHaveBeenCalledTimes(1);

    resolveCatalog({ bots: [bot('initial-snapshot')] });
    const [layoutBots, pageBots] = await Promise.all([layoutLoad, pageLoad]);
    expect(layoutBots).toEqual(pageBots);
    expect(pageBots).toHaveLength(1);
    expect(store.supportedBotsLoaded).toBe(true);
  });

  it('caches overview by report snapshot and invalidates on incomplete and marker-only snapshot changes', async () => {
    let current = bot('valid-1');
    apiMocks.fetchComparisonBots.mockImplementation(async () => ({ bots: [current] }));
    apiMocks.fetchOverview.mockImplementation(async () => ({
      ...overview(current.report.snapshot_id), report: current.report,
    }));

    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    store.setSelectedBot('derive-report');
    store.setSelectedSleeve('hedged');
    await store.loadOverview('derive-report', '20260101-20260413');
    await store.loadOverview('derive-report', '20260101-20260413');
    expect(apiMocks.fetchOverview).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchOverview).toHaveBeenLastCalledWith(
      'derive-report', '20260101-20260413', 'hedged',
    );

    // A marker-only/incomplete publication can advance snapshot_id without a new
    // valid manifest. Each such publication must invalidate prior successful pages.
    for (const [snapshotId, status] of [
      ['incomplete-2', 'INCOMPLETE'],
      ['markers-only-3', 'MARKERS_ONLY'],
      ['markers-only-4', 'MARKERS_ONLY'],
    ] as const) {
      current = bot(snapshotId, status);
      await store.ensureComparisonBots(true);
      expect(store.report?.snapshot_id).toBe(snapshotId);
      expect(await store.loadOverview('derive-report', '20260101-20260413')).not.toBeNull();
      expect(apiMocks.fetchOverview).toHaveBeenCalledTimes(2 + [
        'incomplete-2', 'markers-only-3', 'markers-only-4',
      ].indexOf(snapshotId));
    }
  });

  it('retains per-bot and timerange caching for supported report entries', async () => {
    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [
      bot('derive-v1'),
      { ...bot('apex-v1'), bot_id: 'apex-report', display_name: 'Apex report' },
    ] });
    apiMocks.fetchOverview.mockImplementation(async (botId: string, range?: string) =>
      ({ ...overview(`${botId}-${range}`), match_summary: { matched: range === 'range-a' ? 1 : 2 } }));
    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();

    await store.loadOverview('derive-report', 'range-a');
    await store.loadOverview('derive-report', 'range-a');
    await store.loadOverview('derive-report', 'range-b');
    await store.loadOverview('apex-report', 'range-a');

    expect(apiMocks.fetchOverview).toHaveBeenCalledTimes(3);
    expect(store.overviewData?.match_summary.matched).toBe(1);
  });

  it('does not load report pages for bots absent from the report catalog', async () => {
    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [] });
    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    await store.loadOverview('manual-login-bot', 'range-a');

    expect(store.isActiveBotSupported).toBe(false);
    expect(apiMocks.fetchOverview).not.toHaveBeenCalled();
    expect(store.overviewData).toBeNull();
  });

  it('revalidates report metadata when forced and propagates page annotations and snapshot metadata', async () => {
    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [bot('snapshot-1')] });
    apiMocks.fetchOverview.mockResolvedValue({ ...overview('snapshot-1'), report: {
      ...report('snapshot-1'), annotations: [{ code: 'partial_coverage', note: 'Partial source coverage' }],
    } });
    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    store.setSelectedBot('derive-report');
    await store.loadOverview('derive-report');
    expect(store.overviewData?.report.annotations).toEqual([
      { code: 'partial_coverage', note: 'Partial source coverage' },
    ]);
    await store.ensureComparisonBots(true);
    expect(apiMocks.fetchComparisonBots).toHaveBeenCalledTimes(2);

    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [bot('snapshot-2', 'FAILED')] });
    await store.ensureComparisonBots(true);
    expect(store.report?.snapshot_id).toBe('snapshot-2');
    expect(store.overviewData).toBeNull();
  });

  it('does not let an older snapshot response roll back the newest publication', async () => {
    let current = bot('snapshot-a');
    apiMocks.fetchComparisonBots.mockImplementation(async () => ({ bots: [current] }));
    let resolveA!: (value: ReturnType<typeof overview>) => void;
    let resolveB!: (value: ReturnType<typeof overview>) => void;
    apiMocks.fetchOverview
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveB = resolve; }));

    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    store.setSelectedBot('derive-report');
    const requestA = store.loadOverview('derive-report');
    await nextTick();

    current = bot('snapshot-b');
    await store.ensureComparisonBots(true);
    const requestB = store.loadOverview('derive-report');
    await nextTick();
    resolveB(overview('snapshot-b'));
    await requestB;
    resolveA(overview('snapshot-a'));
    await requestA;

    expect(store.report?.snapshot_id).toBe('snapshot-b');
    expect(store.overviewData?.report.snapshot_id).toBe('snapshot-b');
  });

  it('does not display a late response after the user changes report selection', async () => {
    const selectedBot = { ...bot('derive-snapshot'), bot_id: 'derive-report' };
    const otherBot = { ...bot('apex-snapshot'), bot_id: 'apex-report', display_name: 'Apex report' };
    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [selectedBot, otherBot] });
    let resolveDerive!: (value: ReturnType<typeof overview>) => void;
    let resolveApex!: (value: ReturnType<typeof overview>) => void;
    apiMocks.fetchOverview
      .mockImplementationOnce(() => new Promise((resolve) => { resolveDerive = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveApex = resolve; }));

    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    store.setSelectedBot('derive-report');
    const deriveRequest = store.loadOverview('derive-report');
    await nextTick();
    store.setSelectedBot('apex-report');
    const apexRequest = store.loadOverview('apex-report');
    await nextTick();
    resolveApex(overview('apex-snapshot'));
    await apexRequest;
    resolveDerive(overview('derive-snapshot'));
    await deriveRequest;

    expect(store.activeBotId).toBe('apex-report');
    expect(store.overviewData?.report.snapshot_id).toBe('apex-snapshot');
    expect(store.report?.snapshot_id).toBe('apex-snapshot');
  });

  it('restores cached page caveats for the selected sleeve without changing catalog metadata', async () => {
    const portfolio = {
      ...bot('snapshot-1'),
      report: { ...report('snapshot-1'), annotations: [{ code: 'PORTFOLIO', note: 'Portfolio caveat' }] },
    };
    apiMocks.fetchComparisonBots.mockResolvedValue({ bots: [portfolio] });
    apiMocks.fetchOverview.mockImplementation(async (_botId: string, _range?: string, sleeve?: string) => {
      const isCore = sleeve === 'core';
      const childReport = {
        ...report('snapshot-1'),
        annotations: [{ code: isCore ? 'CORE' : 'HEDGED', note: isCore ? 'Core caveat' : 'Hedged caveat' }],
        unavailable_fields: [isCore ? 'live_metrics.sharpe_ratio' : 'equity_curve'],
      };
      return { ...overview('snapshot-1'), report: childReport };
    });

    const store = useTrackedComparisonStore();
    await store.ensureComparisonBots();
    store.setSelectedBot('derive-report');
    store.setSelectedSleeve('core');
    await store.loadOverview('derive-report');
    expect(store.report?.annotations[0]?.code).toBe('CORE');

    store.setSelectedSleeve('hedged');
    await store.loadOverview('derive-report');
    expect(store.report?.annotations[0]?.code).toBe('HEDGED');

    store.setSelectedSleeve('core');
    await store.loadOverview('derive-report');
    expect(store.report?.annotations).toEqual([{ code: 'CORE', note: 'Core caveat' }]);
    expect(store.report?.unavailable_fields).toEqual(['live_metrics.sharpe_ratio']);
    expect(store.activeComparisonBot?.report.annotations).toEqual([
      { code: 'PORTFOLIO', note: 'Portfolio caveat' },
    ]);
    expect(apiMocks.fetchOverview).toHaveBeenCalledTimes(2);
  });
});
