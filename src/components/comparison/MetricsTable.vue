<script setup lang="ts">
import type { MetricsResult } from '@/types';

const props = defineProps<{
  liveMetrics: MetricsResult;
  btMetrics: MetricsResult;
}>();

function formatMetric(key: string, value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A';
  if (key.includes('_pct') || key === 'total_profit_pct') return `${formatDecimal(value)}%`;
  if (key === 'total_trades') return formatNumber(value, 0);
  return formatDecimal(value);
}

const rows = computed(() => {
  const labels: Record<string, string> = {
    total_trades: 'Total trades',
    win_rate_pct: 'Win rate',
    profit_factor: 'Profit factor',
    max_drawdown_pct: 'Max drawdown',
    sharpe_ratio: 'Sharpe ratio',
    avg_duration_hours: 'Avg duration (h)',
    total_profit_pct: 'Total profit',
    expectancy: 'Expectancy',
    cagr_pct: 'CAGR',
    sortino_ratio: 'Sortino ratio',
    calmar_ratio: 'Calmar ratio',
    avg_profit_pct: 'Avg trade profit',
    avg_win_pct: 'Avg win',
    avg_loss_pct: 'Avg loss',
  };
  // The first eight rows always show; the extras only when the report has them.
  const always = new Set(Object.keys(labels).slice(0, 8));
  const present = (key: string) =>
    always.has(key) ||
    props.liveMetrics[key as keyof MetricsResult] != null ||
    props.btMetrics[key as keyof MetricsResult] != null;

  return Object.keys(labels)
    .filter(present)
    .map((key) => {
      const liveValue = props.liveMetrics[key as keyof MetricsResult];
      const btValue = props.btMetrics[key as keyof MetricsResult];
      const delta =
        typeof liveValue === 'number' && typeof btValue === 'number' ? liveValue - btValue : null;
      return {
        key,
        label: labels[key]!,
        live: formatMetric(key, liveValue as number | null | undefined),
        bt: formatMetric(key, btValue as number | null | undefined),
        delta: formatMetric(key, delta),
      };
    });
});

const columns = [
  { accessorKey: 'label', header: 'Metric' },
  { accessorKey: 'live', header: 'Live' },
  { accessorKey: 'bt', header: 'Backtest' },
  { accessorKey: 'delta', header: 'Delta' },
];
</script>

<template>
  <UTable :data="rows" :columns="columns" />
</template>
