<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();

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
  () => [
    activeBotId.value,
    activeTimerange.value,
    activeSleeve.value,
    comparisonStore.isActiveBotSupported,
    comparisonStore.report?.snapshot_id,
  ],
  async () => loadPairs(),
);

type Row = Record<string, unknown>;
const data = computed(() => comparisonStore.pairsData);
const heatmap = computed(() => data.value?.pair_heatmap ?? []);
const heatmapRows = computed<Row[]>(() => heatmap.value.map((r) => ({ ...r })));
const overlapRows = computed<Row[]>(() =>
  Object.entries((data.value?.pair_overlap ?? {}) as Record<string, Row>).map(([pair, v]) => ({
    pair,
    matched: v.matched,
    live_only: v.live_only,
    bt_only: v.bt_only,
  })),
);
const reasonRows = computed<Row[]>(() => (data.value?.exit_reasons ?? []).map((r) => ({ ...r })));
const distribution = computed(() => {
  const d = (data.value?.profit_distribution ?? {}) as { live?: number[]; bt?: number[] };
  return { live: d.live ?? [], bt: d.bt ?? [] };
});
const categoryRows = computed<Row[]>(() => (data.value?.categories ?? []).map((r) => ({ ...r })));
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
    <template v-else-if="data">
      <EmptyComparisonState
        v-if="heatmap.length === 0 && reasonRows.length === 0"
        title="No pair data for this report"
        detail="The report lists no per-pair results in its window."
      />
      <template v-else>
        <UCard>
          <div class="text-lg font-semibold">Pairs where live and backtest diverge most</div>
          <div class="text-sm text-surface-500 text-start">
            Summed trade profit %, top 15 by absolute difference.
          </div>
          <PairDiffChart :rows="heatmap" />
        </UCard>
        <DataTableCard
          title="Profit by pair"
          :rows="heatmapRows"
          :columns="[
            { key: 'pair', label: 'Pair' },
            { key: 'live_profit', label: 'Live', format: 'num' },
            { key: 'bt_profit', label: 'Backtest', format: 'num' },
            { key: 'diff', label: 'Diff', format: 'num' },
          ]"
          :limit="200"
          empty-text="No per-pair profit in this report."
        />
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DataTableCard
            title="Exit reasons"
            :rows="reasonRows"
            :columns="[
              { key: 'reason', label: 'Reason' },
              { key: 'live_count', label: 'Live trades', format: 'int' },
              { key: 'bt_count', label: 'Backtest trades', format: 'int' },
              { key: 'live_profit', label: 'Live profit', format: 'num' },
              { key: 'bt_profit', label: 'Backtest profit', format: 'num' },
            ]"
            empty-text="No exit-reason breakdown."
          />
          <UCard>
            <div class="text-lg font-semibold">Trade profit distribution</div>
            <HistogramChart :live="distribution.live" :bt="distribution.bt" unit="profit %" />
          </UCard>
        </div>
        <DataTableCard
          title="Trade overlap by pair"
          subtitle="How many trades matched, or exist on one side only."
          :rows="overlapRows"
          :columns="[
            { key: 'pair', label: 'Pair' },
            { key: 'matched', label: 'Matched', format: 'int' },
            { key: 'live_only', label: 'Live only', format: 'int' },
            { key: 'bt_only', label: 'Backtest only', format: 'int' },
          ]"
          :limit="200"
        />
        <DataTableCard
          v-if="categoryRows.length > 0"
          title="Categories"
          :rows="categoryRows"
          :columns="Object.keys(categoryRows[0] ?? {}).map((key) => ({ key, label: key }))"
        />
      </template>
    </template>
    <EmptyComparisonState
      v-else
      title="No report pair data"
      detail="Choose a report from the comparison catalog to view pair and category analysis."
    />
  </div>
</template>
