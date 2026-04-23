import type {
  CandlesResponse,
  ComparisonBacktestStatus,
  ComparisonBotInfo,
  OverviewResponse,
  PairsResponse,
  TimelineResponse,
  TradesResponse,
} from '@/types';
import type { Ref, ShallowRef } from 'vue';
import {
  fetchComparisonBacktestStatus,
  fetchComparisonBots,
  fetchComparisonCandles,
  fetchOverview,
  fetchPairs,
  fetchTimeline,
  fetchTrades,
  triggerComparisonBacktest,
} from '@/composables/comparisonApi';

type PageKind = 'overview' | 'timeline' | 'pairs' | 'trades' | 'candles';

type PageDataMap = {
  overview: OverviewResponse;
  timeline: TimelineResponse;
  pairs: PairsResponse;
  trades: TradesResponse;
  candles: CandlesResponse;
};

function cacheKey(botId: string, timerange = ''): string {
  return `${botId}::${timerange || 'default'}`;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = error.response as { data?: { detail?: string } };
    return response.data?.detail ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export const useComparisonStore = defineStore('comparison', () => {
  const supportedBots = ref<ComparisonBotInfo[]>([]);
  const supportedBotsLoaded = ref(false);
  const supportedBotsLoading = ref(false);
  const supportedBotsError = ref('');

  const timerange = ref('');

  const overviewData = ref<OverviewResponse | null>(null);
  const timelineData = ref<TimelineResponse | null>(null);
  const pairsData = ref<PairsResponse | null>(null);
  const tradesData = ref<TradesResponse | null>(null);
  const candlesData = ref<CandlesResponse | null>(null);

  const loading = reactive<Record<PageKind, boolean>>({
    overview: false,
    timeline: false,
    pairs: false,
    trades: false,
    candles: false,
  });

  const errors = reactive<Record<PageKind, string>>({
    overview: '',
    timeline: '',
    pairs: '',
    trades: '',
    candles: '',
  });

  const overviewCache = shallowRef<Record<string, OverviewResponse>>({});
  const timelineCache = shallowRef<Record<string, TimelineResponse>>({});
  const pairsCache = shallowRef<Record<string, PairsResponse>>({});
  const tradesCache = shallowRef<Record<string, TradesResponse>>({});
  const candlesCache = shallowRef<Record<string, CandlesResponse>>({});

  const backtestStatusByBot = ref<Record<string, ComparisonBacktestStatus>>({});
  const toast = useToast();
  const botStore = useBotStore();

  const supportedBotMap = computed<Record<string, ComparisonBotInfo>>(() => {
    return supportedBots.value.reduce<Record<string, ComparisonBotInfo>>((acc, bot) => {
      acc[bot.bot_id] = bot;
      return acc;
    }, {});
  });

  const activeBotId = computed(() => botStore.selectedBot);
  const activeComparisonBot = computed(() => supportedBotMap.value[activeBotId.value]);
  const isActiveBotSupported = computed(() => Boolean(activeComparisonBot.value));
  const activeBotType = computed(() => activeComparisonBot.value?.bot_type ?? null);
  const canRefreshBacktest = computed(() => activeBotType.value === 'FT');

  function setTimerange(value: string) {
    timerange.value = value.trim();
  }

  function isSupportedBot(botId: string): boolean {
    return botId in supportedBotMap.value;
  }

  async function ensureComparisonBots(force = false) {
    if (!force && (supportedBotsLoaded.value || supportedBotsLoading.value)) {
      return supportedBots.value;
    }
    supportedBotsLoading.value = true;
    supportedBotsError.value = '';
    try {
      const response = await fetchComparisonBots();
      supportedBots.value = response.bots;
      supportedBotsLoaded.value = true;
      return supportedBots.value;
    } catch (error) {
      supportedBotsError.value = extractErrorMessage(
        error,
        'Failed to load comparison bot catalog.',
      );
      supportedBotsLoaded.value = false;
      return [];
    } finally {
      supportedBotsLoading.value = false;
    }
  }

  async function loadPage<K extends PageKind>(
    page: K,
    botId: string,
    timerangeValue: string,
    fetcher: (id: string, timerange?: string) => Promise<PageDataMap[K]>,
    cacheRef: ShallowRef<Record<string, PageDataMap[K]>>,
    target: Ref<PageDataMap[K] | null>,
    force = false,
  ) {
    await ensureComparisonBots();
    if (!isSupportedBot(botId)) {
      target.value = null;
      errors[page] = '';
      return null;
    }

    const key = cacheKey(botId, timerangeValue);
    if (!force && cacheRef.value[key]) {
      target.value = cacheRef.value[key]!;
      errors[page] = '';
      return target.value;
    }

    loading[page] = true;
    errors[page] = '';
    try {
      const data = await fetcher(botId, timerangeValue || undefined);
      cacheRef.value = {
        ...cacheRef.value,
        [key]: data,
      };
      target.value = data;
      return data;
    } catch (error) {
      errors[page] = extractErrorMessage(error, `Failed to load ${page} comparison data.`);
      target.value = null;
      return null;
    } finally {
      loading[page] = false;
    }
  }

  async function loadOverview(
    botId = activeBotId.value,
    timerangeValue = timerange.value,
    force = false,
  ) {
    if (!botId) return null;
    return loadPage(
      'overview',
      botId,
      timerangeValue,
      fetchOverview,
      overviewCache,
      overviewData,
      force,
    );
  }

  async function loadTimeline(
    botId = activeBotId.value,
    timerangeValue = timerange.value,
    force = false,
  ) {
    if (!botId) return null;
    return loadPage(
      'timeline',
      botId,
      timerangeValue,
      fetchTimeline,
      timelineCache,
      timelineData,
      force,
    );
  }

  async function loadPairs(
    botId = activeBotId.value,
    timerangeValue = timerange.value,
    force = false,
  ) {
    if (!botId) return null;
    return loadPage('pairs', botId, timerangeValue, fetchPairs, pairsCache, pairsData, force);
  }

  async function loadTrades(
    botId = activeBotId.value,
    timerangeValue = timerange.value,
    force = false,
  ) {
    if (!botId) return null;
    return loadPage('trades', botId, timerangeValue, fetchTrades, tradesCache, tradesData, force);
  }

  async function loadCandles(botId: string, pair: string, timeframeValue: string, force = false) {
    await ensureComparisonBots();
    if (!pair || !timeframeValue || !isSupportedBot(botId)) {
      candlesData.value = null;
      errors.candles = '';
      return null;
    }

    const key = `${botId}::${pair}::${timeframeValue}`;
    if (!force && candlesCache.value[key]) {
      candlesData.value = candlesCache.value[key]!;
      return candlesData.value;
    }

    loading.candles = true;
    errors.candles = '';
    try {
      const data = await fetchComparisonCandles(botId, pair, timeframeValue);
      candlesCache.value = {
        ...candlesCache.value,
        [key]: data,
      };
      candlesData.value = data;
      return data;
    } catch (error) {
      errors.candles = extractErrorMessage(error, 'Failed to load comparison candle markers.');
      candlesData.value = null;
      return null;
    } finally {
      loading.candles = false;
    }
  }

  function getCachedCandles(botId: string, pair: string, timeframeValue: string) {
    return candlesCache.value[`${botId}::${pair}::${timeframeValue}`] ?? null;
  }

  async function pollBacktestStatus(botId: string) {
    const status = await fetchComparisonBacktestStatus(botId);
    backtestStatusByBot.value = {
      ...backtestStatusByBot.value,
      [botId]: status,
    };
    return status;
  }

  async function triggerBacktestRefresh(botId = activeBotId.value) {
    if (!botId || !isSupportedBot(botId) || supportedBotMap.value[botId]?.bot_type !== 'FT') {
      return null;
    }

    try {
      const initialStatus = await triggerComparisonBacktest(botId);
      backtestStatusByBot.value = {
        ...backtestStatusByBot.value,
        [botId]: initialStatus,
      };
      toast.add({
        severity: 'info',
        summary: 'Backtest refresh queued',
        detail: `Refreshing cached backtest for ${supportedBotMap.value[botId]?.display_name ?? botId}.`,
        life: 3000,
      });

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const status = await pollBacktestStatus(botId);
        if (status.status === 'completed') {
          toast.add({
            severity: 'success',
            summary: 'Backtest refresh completed',
            detail: supportedBotMap.value[botId]?.display_name ?? botId,
            life: 3000,
          });
          return status;
        }
        if (status.status === 'error') {
          toast.add({
            severity: 'warn',
            summary: 'Backtest refresh failed',
            detail: status.error ?? `Unable to refresh ${botId}.`,
            life: 5000,
          });
          return status;
        }
      }
      return backtestStatusByBot.value[botId] ?? null;
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to start backtest refresh.');
      backtestStatusByBot.value = {
        ...backtestStatusByBot.value,
        [botId]: {
          status: 'error',
          error: message,
        },
      };
      toast.add({
        severity: 'warn',
        summary: 'Backtest refresh failed',
        detail: message,
        life: 5000,
      });
      return null;
    }
  }

  return {
    supportedBots,
    supportedBotsLoaded,
    supportedBotsLoading,
    supportedBotsError,
    activeComparisonBot,
    isActiveBotSupported,
    activeBotType,
    canRefreshBacktest,
    timerange,
    overviewData,
    timelineData,
    pairsData,
    tradesData,
    candlesData,
    loading,
    errors,
    backtestStatusByBot,
    ensureComparisonBots,
    isSupportedBot,
    setTimerange,
    loadOverview,
    loadTimeline,
    loadPairs,
    loadTrades,
    loadCandles,
    getCachedCandles,
    pollBacktestStatus,
    triggerBacktestRefresh,
  };
});
