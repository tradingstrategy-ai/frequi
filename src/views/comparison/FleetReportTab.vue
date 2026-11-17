<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';
import { useDashboardRegistry } from '@/composables/dashboardRegistry';

/** "Report" tab of the Compare section: the selected bot's full HTML report. */
const { activeBotId } = useComparison();
const { registry, fetchDashboardRegistry, registryBotId } = useDashboardRegistry();

onMounted(() => {
  void fetchDashboardRegistry();
});

const slug = computed(
  () => registry.value?.bots.find((bot) => registryBotId(bot) === activeBotId.value)?.slug ?? '',
);
const hasReports = computed(
  () =>
    registry.value?.bots.find((bot) => registryBotId(bot) === activeBotId.value)?.has_reports ??
    false,
);
</script>

<template>
  <UAlert
    v-if="!slug || !hasReports"
    color="info"
    class="text-start"
    title="No full report for this bot"
    description="This bot has not published a live-vs-backtest HTML report bundle."
  />
  <FleetReportFrame v-else :slug="slug" />
</template>
