<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange } = useComparison();

async function loadTrades() {
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadTrades(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadTrades();
});

watch(
  () => [activeBotId.value, activeTimerange.value, comparisonStore.isActiveBotSupported],
  async () => loadTrades(),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <ProgressSpinner v-if="comparisonStore.loading.trades" class="w-8 h-8 self-center" />
    <Message v-else-if="comparisonStore.errors.trades" severity="warn" class="text-start">
      {{ comparisonStore.errors.trades }}
    </Message>
    <template v-else-if="comparisonStore.tradesData">
      <DataTable
        v-if="comparisonStore.tradesData.slippage.length > 0"
        :value="comparisonStore.tradesData.slippage"
        size="small"
        show-gridlines
      >
        <Column field="pair" header="Pair" />
        <Column field="avg_entry_slippage_pct" header="Entry Slippage" />
        <Column field="avg_exit_slippage_pct" header="Exit Slippage" />
        <Column field="trade_count" header="Trades" />
      </DataTable>
      <EmptyComparisonState
        v-else
        title="Trade deep dive not populated yet"
        detail="The comparison backend still returns empty slippage and deep-dive payloads for this page."
      />

      <JsonPreviewCard
        title="Best / Worst"
        :payload="comparisonStore.tradesData.best_worst"
        empty-text="No best/worst trade payload was returned."
      />
      <JsonPreviewCard
        title="By Direction"
        :payload="comparisonStore.tradesData.by_direction"
        empty-text="No direction summary payload was returned."
      />
      <JsonPreviewCard
        title="Duration Boxplot"
        :payload="comparisonStore.tradesData.duration_boxplot"
        empty-text="No duration boxplot payload was returned."
      />
      <JsonPreviewCard
        title="Scatter"
        :payload="comparisonStore.tradesData.scatter"
        empty-text="No scatter plot payload was returned."
      />
    </template>
  </div>
</template>
