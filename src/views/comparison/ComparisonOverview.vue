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
    <ProgressSpinner v-if="comparisonStore.loading.overview" class="w-8 h-8 self-center" />
    <Message v-else-if="comparisonStore.errors.overview" severity="warn" class="text-start">
      {{ comparisonStore.errors.overview }}
    </Message>
    <template v-else-if="comparisonStore.overviewData">
      <KpiCards
        :live-metrics="comparisonStore.overviewData.live_metrics"
        :bt-metrics="comparisonStore.overviewData.bt_metrics"
        :match-summary="comparisonStore.overviewData.match_summary"
      />

      <Card>
        <template #title>Equity Curve</template>
        <template #content>
          <EquityCurveChart
            :equity-curve="comparisonStore.overviewData.equity_curve"
            :mode="equityCurveMode"
          />
        </template>
      </Card>

      <Card>
        <template #title>Metrics</template>
        <template #content>
          <MetricsTable
            :live-metrics="comparisonStore.overviewData.live_metrics"
            :bt-metrics="comparisonStore.overviewData.bt_metrics"
          />
        </template>
      </Card>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <template #title>Daily Profit</template>
          <template #content>
            <DailyProfitBars :rows="comparisonStore.overviewData.daily_profit" />
          </template>
        </Card>

        <Card>
          <template #title>Monthly Heatmap</template>
          <template #content>
            <MonthlyHeatmap :rows="comparisonStore.overviewData.monthly_heatmap" />
          </template>
        </Card>
      </div>
    </template>
    <EmptyComparisonState
      v-else
      title="No overview data"
      detail="The comparison backend has not returned overview data for the selected bot yet."
    />
  </div>
</template>
