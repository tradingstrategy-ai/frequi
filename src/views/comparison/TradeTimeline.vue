<script setup lang="ts">
import ReportSections from '@/components/comparison/report/ReportSections.vue';
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange, activeSleeve } = useComparison();

async function loadTimeline() {
  await comparisonStore.ensureComparisonBots();
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setSelectedSleeve(activeSleeve.value);
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadTimeline(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadTimeline();
});

watch(
  () => [
    activeBotId.value,
    activeTimerange.value,
    activeSleeve.value,
    comparisonStore.isActiveBotSupported,
    comparisonStore.report?.snapshot_id,
  ],
  async () => loadTimeline(),
);

type Row = Record<string, unknown>;
const data = computed(() => comparisonStore.timelineData);
const statusFilter = ref('All');

const summaryCards = computed(() => {
  const s = data.value?.match_summary;
  return [
    { label: 'Matched', value: s?.matched },
    { label: 'Live only', value: s?.live_only },
    { label: 'Backtest only', value: s?.bt_only },
    { label: 'Match rate', value: s?.match_rate_pct == null ? null : `${s.match_rate_pct}%` },
  ];
});

const windowText = (w: unknown) => {
  const v = w as { start?: string; end?: string } | undefined;
  return v?.start && v.start !== 'nan' ? `${v.start} → ${v.end}` : '—';
};
const ganttRows = computed<Row[]>(() =>
  (data.value?.gantt ?? [])
    .map((g) => ({
      status: g.status,
      pair: g.pair,
      bt: windowText(g.bt),
      live: windowText(g.live),
    }))
    .filter((r) => statusFilter.value === 'All' || r.status === statusFilter.value),
);
const statuses = computed(() => [
  'All',
  ...new Set((data.value?.gantt ?? []).map((g) => String(g.status))),
]);

const pct = (ratio: number | null | undefined) => (ratio == null ? null : ratio * 100);
const matchedRows = computed<Row[]>(() =>
  (data.value?.matched_trades ?? []).map((m) => ({
    pair: m.live_trade.pair,
    bt_entry: m.bt_trade.open_date,
    live_entry: m.live_trade.open_date,
    entry_delay: m.entry_delay_minutes,
    bt_exit: m.bt_trade.close_date,
    live_exit: m.live_trade.close_date,
    exit_delay: m.exit_delay_minutes,
    bt_profit: pct(m.bt_trade.profit_ratio),
    live_profit: pct(m.live_trade.profit_ratio),
    diff: m.profit_diff_pct,
  })),
);
const unmatched = (key: string): Row[] =>
  ((data.value?.unmatched as Record<string, Row[]> | undefined)?.[key] ?? []).map((t) => ({
    pair: t.pair,
    open: t.open_date,
    close: t.close_date,
    reason: t.exit_reason,
    profit: pct(t.profit_ratio as number | null),
  }));
const delays = computed(() => {
  const d = data.value?.delays as
    | { entry_minutes?: (number | null)[]; exit_minutes?: (number | null)[] }
    | undefined;
  return { entry: d?.entry_minutes ?? [], exit: d?.exit_minutes ?? [] };
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="comparisonStore.loading.timeline" class="flex flex-col gap-2 self-center">
      <UIcon name="mdi:loading" class="w-8 h-8 animate-spin" />
    </div>
    <UAlert
      v-else-if="comparisonStore.errors.timeline"
      color="warning"
      class="text-start"
      :title="comparisonStore.errors.timeline"
    />
    <template v-else-if="data">
      <EmptyComparisonState
        v-if="data.matched_trades.length === 0 && data.gantt.length === 0"
        title="No trades to show for this report"
        detail="The report lists no matched or unmatched trades in its window."
      />
      <template v-else>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="timeline-summary">
          <UCard v-for="card in summaryCards" :key="card.label">
            <div class="text-sm text-surface-500">{{ card.label }}</div>
            <div class="text-2xl font-semibold">{{ card.value ?? 'N/A' }}</div>
          </UCard>
        </div>

        <DataTableCard
          title="Matched trades"
          subtitle="Backtest vs live for each paired trade; delays in minutes (live minus backtest)."
          :rows="matchedRows"
          :columns="[
            { key: 'pair', label: 'Pair' },
            { key: 'bt_entry', label: 'BT entry' },
            { key: 'live_entry', label: 'Live entry' },
            { key: 'entry_delay', label: 'Entry delay (min)', format: 'int' },
            { key: 'bt_exit', label: 'BT exit' },
            { key: 'live_exit', label: 'Live exit' },
            { key: 'exit_delay', label: 'Exit delay (min)', format: 'int' },
            { key: 'bt_profit', label: 'BT profit', format: 'pct' },
            { key: 'live_profit', label: 'Live profit', format: 'pct' },
            { key: 'diff', label: 'Diff', format: 'pct' },
          ]"
          empty-text="No matched trades in this report."
        />

        <div v-if="matchedRows.length > 0" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <UCard>
            <div class="text-lg font-semibold">Entry delay distribution</div>
            <HistogramChart
              :live="delays.entry"
              :bt="[]"
              unit="minutes"
              live-label="Live − backtest"
            />
          </UCard>
          <UCard>
            <div class="text-lg font-semibold">Exit delay distribution</div>
            <HistogramChart
              :live="delays.exit"
              :bt="[]"
              unit="minutes"
              live-label="Live − backtest"
            />
          </UCard>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <DataTableCard
            title="Live only"
            subtitle="Trades the live bot took that the backtest did not."
            :rows="unmatched('live_only')"
            :columns="[
              { key: 'pair', label: 'Pair' },
              { key: 'open', label: 'Open' },
              { key: 'close', label: 'Close' },
              { key: 'reason', label: 'Exit reason' },
              { key: 'profit', label: 'Profit', format: 'pct' },
            ]"
            :limit="60"
            empty-text="No live-only trades."
          />
          <DataTableCard
            title="Backtest only"
            subtitle="Trades the backtest took that the live bot did not."
            :rows="unmatched('bt_only')"
            :columns="[
              { key: 'pair', label: 'Pair' },
              { key: 'open', label: 'Open' },
              { key: 'close', label: 'Close' },
              { key: 'reason', label: 'Exit reason' },
              { key: 'profit', label: 'Profit', format: 'pct' },
            ]"
            :limit="60"
            empty-text="No backtest-only trades."
          />
        </div>

        <UCard>
          <div class="flex items-center gap-3 mb-2">
            <div class="text-lg font-semibold">All trades</div>
            <USelect v-model="statusFilter" :items="statuses" class="min-w-40" />
          </div>
          <DataTableCard
            title=""
            :rows="ganttRows"
            :columns="[
              { key: 'status', label: 'Status' },
              { key: 'pair', label: 'Pair' },
              { key: 'bt', label: 'Backtest window' },
              { key: 'live', label: 'Live window' },
            ]"
            :limit="150"
          />
        </UCard>
      </template>
    </template>
    <EmptyComparisonState
      v-else
      title="No report timeline data"
      detail="Choose a report from the comparison catalog to view its timeline."
    />
    <ReportSections tab="timeline" />
  </div>
</template>
