<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();

const pairHeatmapColumns = [
  { accessorKey: 'pair', header: 'Pair' },
  { accessorKey: 'live_profit', header: 'Live', cell: ({ row }: { row: { original: { live_profit: number | null } } }) => row.original.live_profit ?? 'N/A' },
  { accessorKey: 'bt_profit', header: 'Backtest', cell: ({ row }: { row: { original: { bt_profit: number | null } } }) => row.original.bt_profit ?? 'N/A' },
  { accessorKey: 'diff', header: 'Diff', cell: ({ row }: { row: { original: { diff: number | null } } }) => row.original.diff ?? 'N/A' },
];

async function loadPairs() {
  await comparisonStore.ensureComparisonBots();
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setSelectedSleeve(activeSleeve.value);
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadPairs(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadPairs();
});

watch(
  () => [activeBotId.value, activeTimerange.value, activeSleeve.value, comparisonStore.isActiveBotSupported, comparisonStore.report?.snapshot_id],
  async () => loadPairs(),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="comparisonStore.loading.pairs" class="flex flex-col gap-2 self-center">
      <UIcon name="mdi:loading" class="w-8 h-8 animate-spin" />
    </div>
    <UAlert
      v-else-if="comparisonStore.errors.pairs"
      color="warning"
      class="text-start"
      :title="comparisonStore.errors.pairs"
    />
    <template v-else-if="comparisonStore.pairsData">
      <UTable
        v-if="comparisonStore.pairsData.pair_heatmap.length > 0"
        :data="comparisonStore.pairsData.pair_heatmap"
        :columns="pairHeatmapColumns"
      />
      <EmptyComparisonState
        v-else
        title="Pair heatmap not populated yet"
        detail="The page is ready, but the backend still returns an empty pair heatmap payload."
      />

      <JsonPreviewCard
        title="Pair Overlap"
        :payload="comparisonStore.pairsData.pair_overlap"
        empty-text="No pair overlap payload was returned."
      />
      <JsonPreviewCard
        title="Exit Reasons"
        :payload="comparisonStore.pairsData.exit_reasons"
        empty-text="No exit reason rows were returned."
      />
      <JsonPreviewCard
        title="Categories"
        :payload="comparisonStore.pairsData.categories"
        empty-text="No market-cap category payload was returned."
      />
    </template>
    <EmptyComparisonState v-else title="No report pair data"
      detail="Choose a report from the comparison catalog to view pair and category analysis." />
  </div>
</template>
