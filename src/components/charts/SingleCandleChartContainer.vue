<script setup lang="ts">
import type { BtMarker, ChartSliderPosition, PairHistory, PlotConfig, Trade } from '@/types';
import { LoadingStatus } from '@/types';
import { useComparisonStore } from '@/stores/comparisonStore';
import ReportFigure from '@/components/comparison/report/ReportFigure.vue';

const props = withDefaults(
  defineProps<{
    trades?: Trade[];
    availablePairs: string[];
    timeframe: string;
    historicView?: boolean;
    pair?: string;
    sliderPosition?: ChartSliderPosition;
    isSinglePairView?: boolean;
  }>(),
  {
    trades: () => [],
    historicView: false,
    pair: '',
    sliderPosition: undefined,
    isSinglePairView: true,
  },
);

const emit = defineEmits<{
  refreshData: [pair: string, columns: string[]];
}>();

const settingsStore = useSettingsStore();
const colorStore = useColorStore();
const botStore = useBotStore();
const plotStore = usePlotConfigStore();
const comparisonStore = useComparisonStore();

const dataset = computed((): PairHistory | undefined => {
  if (props.historicView) {
    return botStore.activeBot.history[`${props.pair}__${props.timeframe}`]?.data;
  }
  return botStore.activeBot.candleData[`${props.pair}__${props.timeframe}`]?.data;
});

const datasetColumns = computed(() =>
  dataset.value ? (dataset.value.all_columns ?? dataset.value.columns) : [],
);
const datasetLoadedColumns = computed(() =>
  dataset.value ? (dataset.value.columns ?? dataset.value.all_columns) : [],
);

const hasDataset = computed(() => dataset.value && dataset.value.data.length > 0);
const isLoadingDataset = computed((): boolean => {
  if (props.historicView) {
    return botStore.activeBot.historyStatus === LoadingStatus.loading;
  }

  return botStore.activeBot.candleDataStatus === LoadingStatus.loading;
});
const noDatasetText = computed((): string => {
  const status = props.historicView
    ? botStore.activeBot.historyStatus
    : botStore.activeBot.candleDataStatus;

  switch (status) {
    case LoadingStatus.not_loaded:
      return 'Not loaded yet.';
    case LoadingStatus.loading:
      return 'Loading...';
    case LoadingStatus.success:
      return 'No data available';
    case LoadingStatus.error:
      return 'Failed to load data';
    default:
      return 'Unknown';
  }
});

const comparisonCapable = computed(() => comparisonStore.isSupportedBot(botStore.selectedBot));

const btMarkers = computed<BtMarker[]>(() => {
  if (!settingsStore.showBtTradeOverlay || !comparisonCapable.value || !props.pair) {
    return [];
  }
  return (
    comparisonStore.getCachedCandles(botStore.selectedBot, props.pair, props.timeframe)
      ?.bt_markers ?? []
  );
});

const liveMarkers = computed<BtMarker[]>(() => {
  if (!settingsStore.showBtTradeOverlay || !comparisonCapable.value || !props.pair) {
    return [];
  }
  return (
    comparisonStore.getCachedCandles(botStore.selectedBot, props.pair, props.timeframe)
      ?.live_markers ?? []
  );
});

const cachedCandles = computed(() =>
  settingsStore.showBtTradeOverlay && comparisonCapable.value && props.pair
    ? comparisonStore.getCachedCandles(botStore.selectedBot, props.pair, props.timeframe)
    : undefined,
);
/** The strategy's indicator lines from the report's overlay chart for this pair. */
const indicatorLines = computed(() => cachedCandles.value?.indicators ?? []);
/** The report's full overlay figure for this pair (candles, fills, all indicator panels). */
const reportOverlay = computed(() => cachedCandles.value?.overlay ?? null);
const showReportOverlay = ref(false);

/**
 * The plot config the chart draws: the user's, plus the strategy indicators a Nautilus
 * bot recorded live (shipped with its candles by the dashboard gateway) when shown.
 */
const effectivePlotConfig = computed<PlotConfig>(() => {
  const telemetry = dataset.value?.plot_config;
  if (!settingsStore.showStrategyIndicators || !telemetry) return plotStore.plotConfig;
  return {
    ...plotStore.plotConfig,
    main_plot: { ...telemetry.main_plot, ...plotStore.plotConfig.main_plot },
    subplots: { ...telemetry.subplots, ...plotStore.plotConfig.subplots },
  };
});

function refresh() {
  emit('refreshData', props.pair, plotStore.usedColumns);
}

function refreshIfNecessary() {
  if (!hasDataset.value) {
    refresh();
  }
}

function assignFirstPair() {
  const [firstPair] = props.availablePairs;
  if (firstPair) {
    //props.pair = firstPair;
  }
}

async function loadBtMarkers() {
  if (!settingsStore.showBtTradeOverlay || !comparisonCapable.value || !props.pair) {
    return;
  }
  await comparisonStore.loadCandles(botStore.selectedBot, props.pair, props.timeframe);
}

watch(
  () => props.availablePairs,
  () => {
    if (!props.availablePairs.find((p) => p === props.pair)) {
      assignFirstPair();
      refresh();
    }
  },
);

watch(
  () => plotStore.plotConfig,
  () => {
    // Trigger reload if the used columns are not loaded yet but would be available.
    const hasAllColumns = plotStore.usedColumns.some(
      (c) => datasetColumns.value.includes(c) && !datasetLoadedColumns.value.includes(c),
    );

    if (settingsStore.useReducedPairCalls && hasAllColumns) {
      refresh();
    }
  },
);

watch(
  () => props.timeframe,
  () => {
    refreshIfNecessary();
    loadBtMarkers().then();
  },
);

watch(
  () => [settingsStore.showBtTradeOverlay, props.pair, props.timeframe, botStore.selectedBot],
  () => {
    loadBtMarkers().then();
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <div
    class="flex-fill w-full flex-col align-items-stretch flex"
    :class="{
      'h-full': isSinglePairView,
      'h-150 border border-r border-b border-neutral-300 dark:border-neutral-700':
        !isSinglePairView,
    }"
  >
    <div class="flex me-0 w-full items-center justify-between">
      <div class="ms-1 md:ms-2 flex flex-wrap md:flex-nowrap items-center gap-1">
        <div class="flex flex-col md:flex-row md:gap-2">
          <div class="flex flex-row flex-wrap gap-2">
            <small v-if="dataset" class="text-sm text-nowrap" title="Long entry signals"
              >Long entries: {{ dataset.enter_long_signals || dataset.buy_signals }}</small
            >
            <small v-if="dataset" class="text-sm text-nowrap" title="Long exit signals"
              >Long exit: {{ dataset.exit_long_signals || dataset.sell_signals }}</small
            >
          </div>
          <div class="flex flex-row flex-wrap gap-2">
            <small v-if="dataset && dataset.enter_short_signals" class="text-sm text-nowrap"
              >Short entries: {{ dataset.enter_short_signals }}</small
            >
            <small v-if="dataset && dataset.exit_short_signals" class="text-sm text-nowrap"
              >Short exits: {{ dataset.exit_short_signals }}</small
            >
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        {{ pair || 'Pair' }}
        <UButton
          v-if="reportOverlay"
          size="xs"
          variant="outline"
          icon="mdi:chart-box-outline"
          data-testid="open-report-overlay"
          title="The daily report's chart for this pair: BT and live fills with every strategy indicator panel"
          @click="showReportOverlay = true"
        >
          Report overlay
        </UButton>
      </div>
      <UModal
        v-if="reportOverlay"
        v-model:open="showReportOverlay"
        :title="reportOverlay.title"
        description="From the daily live-vs-backtest report. Indicators are recomputed from venue candles, so backtest and live share them."
        :ui="{ content: 'max-w-[95vw] w-[95vw]' }"
      >
        <template #body>
          <ReportFigure
            :bot-id="botStore.selectedBot"
            :report="reportOverlay.report"
            :figure-id="reportOverlay.figure"
            :title="reportOverlay.title"
            :height="null"
          />
        </template>
      </UModal>
      <div class="w-4 h-4">
        <UProgress v-if="isLoadingDataset" stroke-width="4" small label="Spinning" />
      </div>
    </div>
    <div class="h-full flex">
      <div class="min-w-0 w-full flex-1">
        <CandleChart
          v-if="hasDataset && dataset"
          :dataset="dataset"
          :trades="trades"
          :bt-markers="btMarkers"
          :live-markers="liveMarkers"
          :indicator-lines="indicatorLines"
          :plot-config="effectivePlotConfig"
          :heikin-ashi="settingsStore.useHeikinAshiCandles"
          :show-mark-area="settingsStore.showMarkArea"
          :use-u-t-c="settingsStore.timezone === 'UTC'"
          :theme="settingsStore.chartTheme"
          :slider-position="sliderPosition"
          :color-up="colorStore.colorUp"
          :color-down="colorStore.colorDown"
          :start-candle-count="settingsStore.chartDefaultCandleCount"
          :label-side="settingsStore.chartLabelSide"
        />
        <div v-else class="m-auto">
          <UProgress v-if="isLoadingDataset" class="m-5 w-5 h-5" label="Spinning" />
          <div v-else class="text-lg">
            {{ noDatasetText }}
          </div>
          <p v-if="botStore.activeBot.historyTakesLonger">
            This is taking longer than expected ... Hold on ...
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
