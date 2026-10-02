<script setup lang="ts">
import type { OverviewResponse } from '@/types';
import { fetchOverview } from '@/composables/comparisonApi';
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();
const equityCurveMode = 'account_balance' as const;
type SleeveOverviewRow = { sleeve: string; overview: OverviewResponse | null };
const sleeveOverviewRows = ref<SleeveOverviewRow[]>([]);
const sleeveOverviewLoading = ref(false);
const sleeveOverviewError = ref('');
let sleeveOverviewGeneration = 0;
const hasAccountBalanceSeries = computed(() =>
  [
    ...(comparisonStore.overviewData?.equity_curve.live ?? []),
    ...(comparisonStore.overviewData?.equity_curve.bt ?? []),
  ].some((point) => point.value !== null),
);

function formatMetric(value: number | null | undefined, digits: number, suffix = ''): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(digits)}${suffix}`
    : 'N/A';
}

const sleeveTableRows = computed(() =>
  sleeveOverviewRows.value.map(({ sleeve, overview }) => ({
    sleeve,
    liveTrades: overview?.live_metrics.total_trades ?? 'N/A',
    backtestTrades: overview?.bt_metrics.total_trades ?? 'N/A',
    liveWinRate: formatMetric(overview?.live_metrics.win_rate_pct, 1, '%'),
    backtestWinRate: formatMetric(overview?.bt_metrics.win_rate_pct, 1, '%'),
    liveProfitFactor: formatMetric(overview?.live_metrics.profit_factor, 2),
    backtestProfitFactor: formatMetric(overview?.bt_metrics.profit_factor, 2),
    liveExpectancy: formatMetric(overview?.live_metrics.expectancy, 2, '%'),
    backtestExpectancy: formatMetric(overview?.bt_metrics.expectancy, 2, '%'),
    matched: overview?.match_summary.matched ?? 'N/A',
    liveOnly: overview?.match_summary.live_only ?? 'N/A',
    backtestOnly: overview?.match_summary.bt_only ?? 'N/A',
    matchRate: formatMetric(overview?.match_summary.match_rate_pct, 1, '%'),
  })),
);

const sleeveTableColumns = [
  { accessorKey: 'sleeve', header: 'Sub-strategy' },
  { accessorKey: 'liveTrades', header: 'Live trades' },
  { accessorKey: 'backtestTrades', header: 'Backtest trades' },
  { accessorKey: 'liveWinRate', header: 'Live win rate' },
  { accessorKey: 'backtestWinRate', header: 'Backtest win rate' },
  { accessorKey: 'liveProfitFactor', header: 'Live profit factor' },
  { accessorKey: 'backtestProfitFactor', header: 'Backtest profit factor' },
  { accessorKey: 'liveExpectancy', header: 'Live avg trade' },
  { accessorKey: 'backtestExpectancy', header: 'Backtest avg trade' },
  { accessorKey: 'matched', header: 'Matched' },
  { accessorKey: 'liveOnly', header: 'Live only' },
  { accessorKey: 'backtestOnly', header: 'Backtest only' },
  { accessorKey: 'matchRate', header: 'Live match rate' },
];

async function loadSleeveOverviewRows() {
  const request = ++sleeveOverviewGeneration;
  const bot = comparisonStore.activeComparisonBot;
  const sleeves = bot?.sleeves ?? [];
  if (!bot || sleeves.length === 0 || activeSleeve.value || bot.report.status !== 'SUCCESS') {
    sleeveOverviewRows.value = [];
    sleeveOverviewError.value = '';
    sleeveOverviewLoading.value = false;
    return;
  }
  sleeveOverviewLoading.value = true;
  sleeveOverviewError.value = '';
  const rows = await Promise.all(
    sleeves.map(async (sleeve) => {
      try {
        const overview = await fetchOverview(
          bot.bot_id,
          activeTimerange.value || undefined,
          sleeve,
        );
        return { sleeve, overview };
      } catch {
        return { sleeve, overview: null };
      }
    }),
  );
  if (request !== sleeveOverviewGeneration) return;
  sleeveOverviewRows.value = rows;
  sleeveOverviewLoading.value = false;
  if (rows.some((row) => row.overview === null)) {
    sleeveOverviewError.value = 'One or more sub-strategy breakdowns could not be loaded.';
  }
}

async function loadOverview() {
  await comparisonStore.ensureComparisonBots();
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setSelectedSleeve(activeSleeve.value);
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadOverview(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadOverview();
  await loadSleeveOverviewRows();
});

watch(
  () => [
    activeBotId.value,
    activeTimerange.value,
    activeSleeve.value,
    comparisonStore.isActiveBotSupported,
    comparisonStore.report?.snapshot_id,
  ],
  async () => {
    await loadOverview();
    await loadSleeveOverviewRows();
  },
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="comparisonStore.loading.overview" class="flex flex-col gap-2 self-center">
      <UIcon name="mdi:loading" class="w-8 h-8 animate-spin" />
    </div>
    <UAlert
      v-else-if="comparisonStore.errors.overview"
      color="warning"
      class="text-start"
      :title="comparisonStore.errors.overview"
    />
    <template v-else-if="comparisonStore.overviewData">
      <KpiCards
        :live-metrics="comparisonStore.overviewData.live_metrics"
        :bt-metrics="comparisonStore.overviewData.bt_metrics"
        :match-summary="comparisonStore.overviewData.match_summary"
      />

      <UCard v-if="comparisonStore.activeComparisonBot?.sleeves.length && !activeSleeve">
        <div class="text-lg font-semibold mb-1">Sub-strategy breakdown</div>
        <p class="mb-3 text-sm text-surface-500">
          Per-sleeve trade counts, match rates and trade-level win rate, profit factor and average
          trade profit (%). Trade-level figures come from each closed trade's rounded profit %, not
          from account return; sleeve drawdown, Sharpe, total return and equity are not published.
          N/A means the sleeve has no qualifying trades or the figure is undefined.
        </p>
        <div v-if="sleeveOverviewLoading" class="flex justify-center py-3">
          <UIcon name="mdi:loading" class="w-6 h-6 animate-spin" />
        </div>
        <UAlert
          v-else-if="sleeveOverviewError"
          color="warning"
          class="mb-3 text-start"
          :title="sleeveOverviewError"
        />
        <UTable
          v-if="sleeveTableRows.length"
          :data="sleeveTableRows"
          :columns="sleeveTableColumns"
        />
      </UCard>

      <UCard>
        <div class="text-lg font-semibold mb-2">Equity Curve</div>
        <UAlert
          v-if="activeTimerange"
          color="info"
          class="mb-3 text-start"
          title="Account series are unavailable for an entry-date timerange"
          description="The timerange selects trades by entry date, while account balance, daily profit, and monthly return series use close-date accounting. Showing them together would include profits from trades outside the selected entry cohort."
        />
        <p v-if="hasAccountBalanceSeries" class="mb-2 text-sm text-surface-500">
          Realized account balance, updated at trade close.
        </p>
        <EquityCurveChart
          :equity-curve="comparisonStore.overviewData.equity_curve"
          :mode="equityCurveMode"
        />
      </UCard>

      <UCard>
        <div class="text-lg font-semibold mb-2">Metrics</div>
        <MetricsTable
          :live-metrics="comparisonStore.overviewData.live_metrics"
          :bt-metrics="comparisonStore.overviewData.bt_metrics"
        />
      </UCard>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <UCard>
          <div class="text-lg font-semibold mb-2">Daily Profit</div>
          <DailyProfitBars :rows="comparisonStore.overviewData.daily_profit" />
        </UCard>

        <UCard>
          <div class="text-lg font-semibold mb-2">Monthly Heatmap</div>
          <MonthlyHeatmap :rows="comparisonStore.overviewData.monthly_heatmap" />
        </UCard>
      </div>
    </template>
    <EmptyComparisonState
      v-else
      title="No overview data"
      detail="The comparison backend has not returned overview data for the selected bot yet."
    />
  </div>
</template>
