<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();

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
  () => [
    activeBotId.value,
    activeTimerange.value,
    activeSleeve.value,
    comparisonStore.isActiveBotSupported,
    comparisonStore.report?.snapshot_id,
  ],
  async () => loadTrades(),
);

type Row = Record<string, unknown>;
const data = computed(() => comparisonStore.tradesData);

const fmt = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(2)}%` : 'N/A';
const bestWorst = computed(() => {
  const b = (data.value?.best_worst ?? {}) as Record<string, number | null>;
  return [
    { label: 'Best trade', live: fmt(b.live_best_pct), bt: fmt(b.bt_best_pct) },
    { label: 'Worst trade', live: fmt(b.live_worst_pct), bt: fmt(b.bt_worst_pct) },
  ];
});

const stats = (values: number[]) => {
  if (values.length === 0) return { n: 0, min: null, median: null, mean: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return {
    n: sorted.length,
    min: sorted[0]!,
    median,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    max: sorted[sorted.length - 1]!,
  };
};
const durations = computed<Row[]>(() => {
  const d = (data.value?.duration_boxplot ?? {}) as { live_hours?: number[]; bt_hours?: number[] };
  return [
    { side: 'Live', ...stats(d.live_hours ?? []) },
    { side: 'Backtest', ...stats(d.bt_hours ?? []) },
  ];
});
const durationValues = computed(() => {
  const d = (data.value?.duration_boxplot ?? {}) as { live_hours?: number[]; bt_hours?: number[] };
  return { live: d.live_hours ?? [], bt: d.bt_hours ?? [] };
});
const scatterRows = computed<Row[]>(() =>
  [...((data.value?.scatter ?? []) as Row[])].sort(
    (a, b) =>
      Math.abs((b.profit_diff_pct as number) ?? 0) - Math.abs((a.profit_diff_pct as number) ?? 0),
  ),
);
const slippageRows = computed<Row[]>(() => (data.value?.slippage ?? []).map((r) => ({ ...r })));
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
    <template v-else-if="data">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="best-worst">
        <UCard v-for="row in bestWorst" :key="row.label">
          <div class="text-lg font-semibold mb-2">{{ row.label }}</div>
          <div class="text-start">
            <div><span class="text-surface-500">Live:</span> {{ row.live }}</div>
            <div><span class="text-surface-500">Backtest:</span> {{ row.bt }}</div>
          </div>
        </UCard>
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DataTableCard
          title="Trade duration (hours)"
          :rows="durations"
          :columns="[
            { key: 'side', label: 'Side' },
            { key: 'n', label: 'Trades', format: 'int' },
            { key: 'min', label: 'Min', format: 'num' },
            { key: 'median', label: 'Median', format: 'num' },
            { key: 'mean', label: 'Mean', format: 'num' },
            { key: 'max', label: 'Max', format: 'num' },
          ]"
        />
        <UCard>
          <div class="text-lg font-semibold">Duration distribution</div>
          <HistogramChart :live="durationValues.live" :bt="durationValues.bt" unit="hours" />
        </UCard>
      </div>
      <DataTableCard
        title="Per-trade profit, live vs backtest"
        subtitle="Largest divergences first; trades seen on one side only show a dash."
        :rows="scatterRows"
        :columns="[
          { key: 'pair', label: 'Pair' },
          { key: 'live_profit_pct', label: 'Live profit', format: 'pct' },
          { key: 'bt_profit_pct', label: 'Backtest profit', format: 'pct' },
          { key: 'profit_diff_pct', label: 'Diff', format: 'pct' },
        ]"
        :limit="200"
        empty-text="No per-trade profit rows in this report."
      />
      <DataTableCard
        v-if="slippageRows.length > 0"
        title="Slippage by pair"
        :rows="slippageRows"
        :columns="[
          { key: 'pair', label: 'Pair' },
          { key: 'avg_entry_slippage_pct', label: 'Entry slippage', format: 'pct' },
          { key: 'avg_exit_slippage_pct', label: 'Exit slippage', format: 'pct' },
          { key: 'trade_count', label: 'Trades', format: 'int' },
        ]"
      />
    </template>
    <EmptyComparisonState
      v-else
      title="No report trade data"
      detail="Choose a report from the comparison catalog to view the trade deep dive."
    />
  </div>
</template>
