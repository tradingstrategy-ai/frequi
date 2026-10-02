import type {
  CandlesResponse,
  ComparisonBotInfo,
  DashboardReportMetadata,
  OverviewResponse,
  PairsResponse,
  TimelineResponse,
  TradesResponse,
} from '@/types';
import { onScopeDispose, type Ref, type ShallowRef } from 'vue';
import {
  fetchComparisonBots,
  fetchComparisonCandles,
  fetchOverview,
  fetchPairs,
  fetchTimeline,
  fetchTrades,
} from '@/composables/comparisonApi';

type PageKind = 'overview' | 'timeline' | 'pairs' | 'trades' | 'candles';
type PageDataMap = {
  overview: OverviewResponse;
  timeline: TimelineResponse;
  pairs: PairsResponse;
  trades: TradesResponse;
  candles: CandlesResponse;
};
type ActivePageReport = {
  page: PageKind;
  selectionKey: string;
  report: DashboardReportMetadata;
};

const METADATA_MAX_AGE = 5 * 60 * 1000;

function cacheKey(botId: string, sleeve: string, timerange: string, snapshotId: string): string {
  return [botId, sleeve || 'all-sleeves', timerange || 'full-report', snapshotId].join('::');
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = error.response as { status?: number; data?: { detail?: string } };
    if (response.status === 401) return 'Authentication required. Connect to reports to continue.';
    return response.data?.detail ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'response' in error &&
    (error.response as { status?: number }).status === 401;
}

export const useComparisonStore = defineStore(
  'comparison',
  () => {
    const supportedBots = ref<ComparisonBotInfo[]>([]);
    const supportedBotsLoaded = ref(false);
    const supportedBotsLoading = ref(false);
    const supportedBotsError = ref('');
    const authRequired = ref(false);
    const selectedBotId = ref('');
    const selectedSleeve = ref('');
    const timerange = ref('');
    const lastMetadataCheckAt = ref(0);

    const overviewData = ref<OverviewResponse | null>(null);
    const timelineData = ref<TimelineResponse | null>(null);
    const pairsData = ref<PairsResponse | null>(null);
    const tradesData = ref<TradesResponse | null>(null);
    const candlesData = ref<CandlesResponse | null>(null);
    const loading = reactive<Record<PageKind, boolean>>({
      overview: false, timeline: false, pairs: false, trades: false, candles: false,
    });
    const errors = reactive<Record<PageKind, string>>({
      overview: '', timeline: '', pairs: '', trades: '', candles: '',
    });
    const overviewCache = shallowRef<Record<string, OverviewResponse>>({});
    const timelineCache = shallowRef<Record<string, TimelineResponse>>({});
    const pairsCache = shallowRef<Record<string, PairsResponse>>({});
    const tradesCache = shallowRef<Record<string, TradesResponse>>({});
    const candlesCache = shallowRef<Record<string, CandlesResponse>>({});
    let metadataRequest: Promise<ComparisonBotInfo[]> | null = null;
    let selectionGeneration = 0;
    const pageRequestGeneration: Record<PageKind, number> = {
      overview: 0, timeline: 0, pairs: 0, trades: 0, candles: 0,
    };
    const activePage = ref<PageKind | null>(null);
    const activePageReport = shallowRef<ActivePageReport | null>(null);

    function selectionKey(botId = selectedBotId.value, sleeve = selectedSleeve.value, range = timerange.value): string {
      return JSON.stringify([botId, sleeve, range]);
    }

    function selectionChanged() {
      selectionGeneration += 1;
      activePageReport.value = null;
      Object.keys(loading).forEach((page) => {
        loading[page as PageKind] = false;
        errors[page as PageKind] = '';
      });
    }

    function requestIsCurrent(page: PageKind, requestId: number, requestGeneration: number): boolean {
      return pageRequestGeneration[page] === requestId &&
        selectionGeneration === requestGeneration &&
        activePage.value === page;
    }

    function setActivePageReport(page: PageKind, requestSelection: string, metadata: DashboardReportMetadata) {
      activePageReport.value = { page, selectionKey: requestSelection, report: metadata };
    }

    const supportedBotMap = computed<Record<string, ComparisonBotInfo>>(() =>
      Object.fromEntries(supportedBots.value.map((bot) => [bot.bot_id, bot])),
    );
    const activeBotId = computed(() => selectedBotId.value);
    const activeComparisonBot = computed(() => supportedBotMap.value[activeBotId.value]);
    const isActiveBotSupported = computed(() => Boolean(activeComparisonBot.value));
    const activeBotType = computed(() => activeComparisonBot.value?.bot_type ?? null);
    const report = computed(() => {
      const catalogueReport = activeComparisonBot.value?.report ?? null;
      const pageReport = activePageReport.value;
      if (
        catalogueReport && pageReport && pageReport.page === activePage.value &&
        pageReport.selectionKey === selectionKey() &&
        pageReport.report.snapshot_id === catalogueReport.snapshot_id
      ) return pageReport.report;
      return catalogueReport;
    });

    function clearDisplayedPages() {
      overviewData.value = null;
      timelineData.value = null;
      pairsData.value = null;
      tradesData.value = null;
      candlesData.value = null;
    }

    function invalidateBot(botId: string) {
      const clearBotEntries = <T>(cache: ShallowRef<Record<string, T>>) => {
        cache.value = Object.fromEntries(
          Object.entries(cache.value).filter(([key]) => !key.startsWith(`${botId}::`)),
        );
      };
      clearBotEntries(overviewCache);
      clearBotEntries(timelineCache);
      clearBotEntries(pairsCache);
      clearBotEntries(tradesCache);
      clearBotEntries(candlesCache);
    }

    function updateBotReport(botId: string, nextReport: DashboardReportMetadata) {
      const bot = supportedBotMap.value[botId];
      if (bot && bot.report.snapshot_id !== nextReport.snapshot_id) {
        invalidateBot(botId);
        if (botId === activeBotId.value) {
          clearDisplayedPages();
          activePageReport.value = null;
        }
        supportedBots.value = supportedBots.value.map((item) =>
          item.bot_id === botId ? { ...item, report: nextReport } : item,
        );
      }
    }

    function setSelectedBot(botId: string) {
      if (!botId || !isSupportedBot(botId)) return;
      const before = selectionKey();
      if (selectedBotId.value !== botId) clearDisplayedPages();
      selectedBotId.value = botId;
      if (!activeComparisonBot.value?.sleeves.includes(selectedSleeve.value)) {
        selectedSleeve.value = '';
      }
      if (selectionKey() !== before) selectionChanged();
    }

    function setSelectedSleeve(value: string) {
      const nextValue = activeComparisonBot.value?.sleeves.includes(value) ? value : '';
      if (selectedSleeve.value !== nextValue) {
        selectedSleeve.value = nextValue;
        selectionChanged();
      }
    }

    function setTimerange(value: string) {
      const nextValue = value.trim();
      if (timerange.value !== nextValue) {
        timerange.value = nextValue;
        selectionChanged();
      }
    }

    function isSupportedBot(botId: string): boolean {
      return botId in supportedBotMap.value;
    }

    async function ensureComparisonBots(force = false): Promise<ComparisonBotInfo[]> {
      const fresh = Date.now() - lastMetadataCheckAt.value < METADATA_MAX_AGE;
      if (supportedBotsLoading.value && metadataRequest) {
        return metadataRequest;
      }
      if (!force && fresh) {
        return supportedBots.value;
      }
      supportedBotsLoading.value = true;
      supportedBotsError.value = '';
      lastMetadataCheckAt.value = Date.now();
      metadataRequest = (async () => {
        try {
          const response = await fetchComparisonBots();
          const previous = supportedBotMap.value;
          const selectionBeforeRefresh = selectionKey();
          const activeBeforeRefresh = previous[selectedBotId.value];
          const activeAfterRefresh = response.bots.find((bot) => bot.bot_id === selectedBotId.value);
          if (
            activeBeforeRefresh &&
            (!activeAfterRefresh || activeBeforeRefresh.report.snapshot_id !== activeAfterRefresh.report.snapshot_id)
          ) {
            clearDisplayedPages();
            activePageReport.value = null;
          }
          for (const bot of response.bots) {
            if (previous[bot.bot_id] && previous[bot.bot_id]!.report.snapshot_id !== bot.report.snapshot_id) {
              invalidateBot(bot.bot_id);
            }
          }
          supportedBots.value = response.bots;
          supportedBotsLoaded.value = true;
          if (!isSupportedBot(selectedBotId.value)) {
            selectedBotId.value = response.bots[0]?.bot_id ?? '';
          }
          if (!activeComparisonBot.value?.sleeves.includes(selectedSleeve.value)) {
            selectedSleeve.value = '';
          }
          if (selectionKey() !== selectionBeforeRefresh) selectionChanged();
          authRequired.value = false;
          return supportedBots.value;
        } catch (error) {
          supportedBotsError.value = extractErrorMessage(error, 'Failed to load comparison bot catalog.');
          authRequired.value = isUnauthorized(error);
          supportedBotsLoaded.value = false;
          return [];
        } finally {
          supportedBotsLoading.value = false;
          metadataRequest = null;
        }
      })();
      return metadataRequest;
    }

    async function loadPage<K extends PageKind>(
      page: K,
      botId: string,
      timerangeValue: string,
      sleeve: string,
      fetcher: (id: string, timerange?: string, sleeve?: string) => Promise<PageDataMap[K]>,
      cacheRef: ShallowRef<Record<string, PageDataMap[K]>>,
      target: Ref<PageDataMap[K] | null>,
      force = false,
    ) {
      const requestId = ++pageRequestGeneration[page];
      const requestSelection = selectionKey(botId, sleeve, timerangeValue);
      const requestGeneration = selectionGeneration;
      activePage.value = page;
      await ensureComparisonBots();
      if (!requestIsCurrent(page, requestId, requestGeneration)) return null;
      if (!isSupportedBot(botId)) {
        target.value = null;
        errors[page] = '';
        return null;
      }
      const metadata = supportedBotMap.value[botId]!;
      const key = cacheKey(botId, sleeve, timerangeValue, metadata.report.snapshot_id);
      if (!force && cacheRef.value[key]) {
        const cached = cacheRef.value[key]!;
        target.value = cached;
        errors[page] = '';
        setActivePageReport(page, requestSelection, cached.report);
        return cached;
      }
      loading[page] = true;
      errors[page] = '';
      try {
        const data = await fetcher(botId, timerangeValue || undefined, sleeve || undefined);
        const currentBot = supportedBotMap.value[botId];
        if (!requestIsCurrent(page, requestId, requestGeneration) || !currentBot) return null;
        const catalogueSnapshot = currentBot.report.snapshot_id;
        if (catalogueSnapshot !== metadata.report.snapshot_id && data.report.snapshot_id !== catalogueSnapshot) {
          return null;
        }
        updateBotReport(botId, data.report);
        const responseKey = cacheKey(botId, sleeve, timerangeValue, data.report.snapshot_id);
        cacheRef.value = { ...cacheRef.value, [responseKey]: data };
        target.value = data;
        setActivePageReport(page, requestSelection, data.report);
        authRequired.value = false;
        return data;
      } catch (error) {
        if (requestIsCurrent(page, requestId, requestGeneration)) {
          errors[page] = extractErrorMessage(error, `Failed to load ${page} comparison data.`);
          authRequired.value = isUnauthorized(error);
          target.value = null;
        }
        return null;
      } finally {
        if (pageRequestGeneration[page] === requestId) loading[page] = false;
      }
    }

    async function loadOverview(botId = activeBotId.value, range = timerange.value, force = false) {
      if (!botId) return null;
      return loadPage('overview', botId, range, selectedSleeve.value, fetchOverview, overviewCache, overviewData, force);
    }
    async function loadTimeline(botId = activeBotId.value, range = timerange.value, force = false) {
      if (!botId) return null;
      return loadPage('timeline', botId, range, selectedSleeve.value, fetchTimeline, timelineCache, timelineData, force);
    }
    async function loadPairs(botId = activeBotId.value, range = timerange.value, force = false) {
      if (!botId) return null;
      return loadPage('pairs', botId, range, selectedSleeve.value, fetchPairs, pairsCache, pairsData, force);
    }
    async function loadTrades(botId = activeBotId.value, range = timerange.value, force = false) {
      if (!botId) return null;
      return loadPage('trades', botId, range, selectedSleeve.value, fetchTrades, tradesCache, tradesData, force);
    }

    async function loadCandles(botId: string, pair: string, timeframeValue: string, force = false) {
      const requestId = ++pageRequestGeneration.candles;
      const requestSelection = selectionKey(botId, selectedSleeve.value, timerange.value);
      const requestGeneration = selectionGeneration;
      activePage.value = 'candles';
      await ensureComparisonBots();
      if (!requestIsCurrent('candles', requestId, requestGeneration)) return null;
      if (!pair || !timeframeValue || !isSupportedBot(botId)) {
        candlesData.value = null;
        errors.candles = '';
        return null;
      }
      const metadata = supportedBotMap.value[botId]!;
      const key = `${cacheKey(botId, selectedSleeve.value, timerange.value, metadata.report.snapshot_id)}::${pair}::${timeframeValue}`;
      if (!force && candlesCache.value[key]) {
        const cached = candlesCache.value[key]!;
        candlesData.value = cached;
        errors.candles = '';
        setActivePageReport('candles', requestSelection, cached.report);
        return candlesData.value;
      }
      loading.candles = true;
      errors.candles = '';
      try {
        const data = await fetchComparisonCandles(botId, pair, timeframeValue, timerange.value || undefined, selectedSleeve.value || undefined);
        const currentBot = supportedBotMap.value[botId];
        if (!requestIsCurrent('candles', requestId, requestGeneration) || !currentBot) return null;
        const catalogueSnapshot = currentBot.report.snapshot_id;
        if (catalogueSnapshot !== metadata.report.snapshot_id && data.report.snapshot_id !== catalogueSnapshot) {
          return null;
        }
        updateBotReport(botId, data.report);
        const responseKey = `${cacheKey(botId, selectedSleeve.value, timerange.value, data.report.snapshot_id)}::${pair}::${timeframeValue}`;
        candlesCache.value = { ...candlesCache.value, [responseKey]: data };
        candlesData.value = data;
        setActivePageReport('candles', requestSelection, data.report);
        authRequired.value = false;
        return data;
      } catch (error) {
        if (requestIsCurrent('candles', requestId, requestGeneration)) {
          errors.candles = extractErrorMessage(error, 'Failed to load comparison candle markers.');
          authRequired.value = isUnauthorized(error);
          candlesData.value = null;
        }
        return null;
      } finally {
        if (pageRequestGeneration.candles === requestId) loading.candles = false;
      }
    }

    function getCachedCandles(botId: string, pair: string, timeframeValue: string) {
      const snapshotId = supportedBotMap.value[botId]?.report.snapshot_id ?? '';
      const key = `${cacheKey(botId, selectedSleeve.value, timerange.value, snapshotId)}::${pair}::${timeframeValue}`;
      return candlesCache.value[key] ?? null;
    }

    if (typeof document !== 'undefined') {
      const refreshMetadataOnVisible = () => {
        if (document.visibilityState === 'visible' && Date.now() - lastMetadataCheckAt.value >= METADATA_MAX_AGE) {
          void ensureComparisonBots(true);
        }
      };
      document.addEventListener('visibilitychange', refreshMetadataOnVisible);
      const refreshInterval = window.setInterval(refreshMetadataOnVisible, METADATA_MAX_AGE);
      onScopeDispose(() => {
        document.removeEventListener('visibilitychange', refreshMetadataOnVisible);
        window.clearInterval(refreshInterval);
      });
    }

    return {
      supportedBots, supportedBotsLoaded, supportedBotsLoading, supportedBotsError, authRequired,
      selectedBotId, selectedSleeve, timerange, activeBotId, activeComparisonBot,
      isActiveBotSupported, activeBotType, report, overviewData, timelineData, pairsData,
      tradesData, candlesData, loading, errors, ensureComparisonBots, isSupportedBot,
      setSelectedBot, setSelectedSleeve, setTimerange, loadOverview, loadTimeline, loadPairs,
      loadTrades, loadCandles, getCachedCandles,
    };
  },
  { persist: { key: 'ftUIComparisonSettings', pick: ['selectedBotId', 'selectedSleeve'] } },
);
