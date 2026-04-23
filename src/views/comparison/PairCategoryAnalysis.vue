<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange } = useComparison();

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
    <ProgressSpinner v-if="comparisonStore.loading.pairs" class="w-8 h-8 self-center" />
    <Message v-else-if="comparisonStore.errors.pairs" severity="warn" class="text-start">
      {{ comparisonStore.errors.pairs }}
    </Message>
    <template v-else-if="comparisonStore.pairsData">
      <DataTable
        v-if="comparisonStore.pairsData.pair_heatmap.length > 0"
        :value="comparisonStore.pairsData.pair_heatmap"
        size="small"
        show-gridlines
      >
        <Column field="pair" header="Pair" />
        <Column field="live_profit" header="Live" />
        <Column field="bt_profit" header="Backtest" />
        <Column field="diff" header="Diff" />
      </DataTable>
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
