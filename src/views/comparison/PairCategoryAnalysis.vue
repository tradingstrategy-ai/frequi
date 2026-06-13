<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange } = useComparison();

const pairHeatmapColumns = [
  { accessorKey: 'pair', header: 'Pair' },
  { accessorKey: 'live_profit', header: 'Live' },
  { accessorKey: 'bt_profit', header: 'Backtest' },
  { accessorKey: 'diff', header: 'Diff' },
];

async function loadPairs() {
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadPairs(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadPairs();
});

watch(
  () => [activeBotId.value, activeTimerange.value, comparisonStore.isActiveBotSupported],
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
  </div>
</template>
