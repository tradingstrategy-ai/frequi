<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();

const slippageColumns = [
  { accessorKey: 'pair', header: 'Pair' },
  { accessorKey: 'avg_entry_slippage_pct', header: 'Entry Slippage', cell: ({ row }: { row: { original: { avg_entry_slippage_pct: number | null } } }) => row.original.avg_entry_slippage_pct ?? 'N/A' },
  { accessorKey: 'avg_exit_slippage_pct', header: 'Exit Slippage', cell: ({ row }: { row: { original: { avg_exit_slippage_pct: number | null } } }) => row.original.avg_exit_slippage_pct ?? 'N/A' },
  { accessorKey: 'trade_count', header: 'Trades', cell: ({ row }: { row: { original: { trade_count: number | null } } }) => row.original.trade_count ?? 'N/A' },
];

async function loadTrades() {
  await comparisonStore.ensureComparisonBots();
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setSelectedSleeve(activeSleeve.value);
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadTrades(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadTrades();
});

watch(
  () => [activeBotId.value, activeTimerange.value, activeSleeve.value, comparisonStore.isActiveBotSupported, comparisonStore.report?.snapshot_id],
  async () => loadTrades(),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="comparisonStore.loading.trades" class="flex flex-col gap-2 self-center">
      <UIcon name="mdi:loading" class="w-8 h-8 animate-spin" />
    </div>
    <UAlert
      v-else-if="comparisonStore.errors.trades"
      color="warning"
      class="text-start"
      :title="comparisonStore.errors.trades"
    />
    <template v-else-if="comparisonStore.tradesData">
      <UTable
        v-if="comparisonStore.tradesData.slippage.length > 0"
        :data="comparisonStore.tradesData.slippage"
        :columns="slippageColumns"
      />
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
    <EmptyComparisonState v-else title="No report trade data"
      detail="Choose a report from the comparison catalog to view trade-level analysis." />
  </div>
</template>
