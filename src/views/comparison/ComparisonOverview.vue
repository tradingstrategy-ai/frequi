<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange } = useComparison();
const equityCurveMode = computed(() =>
  comparisonStore.activeComparisonBot?.is_vault ? 'share_price' : 'percent',
);

async function loadOverview() {
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadOverview(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadOverview();
});

watch(
  () => [activeBotId.value, activeTimerange.value, comparisonStore.isActiveBotSupported],
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
