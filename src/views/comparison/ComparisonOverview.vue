<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();
const equityCurveMode = 'account_balance' as const;
const hasAccountBalanceSeries = computed(() => [
  ...(comparisonStore.overviewData?.equity_curve.live ?? []),
  ...(comparisonStore.overviewData?.equity_curve.bt ?? []),
].some((point) => point.value !== null));

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
});

watch(
  () => [activeBotId.value, activeTimerange.value, activeSleeve.value, comparisonStore.isActiveBotSupported, comparisonStore.report?.snapshot_id],
  async () => loadOverview(),
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

      <UCard>
        <div class="text-lg font-semibold mb-2">Equity Curve</div>
        <UAlert v-if="activeTimerange" color="info" class="mb-3 text-start"
          title="Account series are unavailable for an entry-date timerange"
          description="The timerange selects trades by entry date, while account balance, daily profit, and monthly return series use close-date accounting. Showing them together would include profits from trades outside the selected entry cohort." />
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
