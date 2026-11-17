<script setup lang="ts">
import type { MatchSummary, MetricsResult } from '@/types';

const props = defineProps<{
  liveMetrics: MetricsResult;
  btMetrics: MetricsResult;
  matchSummary: MatchSummary;
}>();

function formatMetric(value: number | null, type: 'percent' | 'number' | 'count') {
  if (value === null || value === undefined) return 'N/A';
  if (type === 'count') return formatNumber(value, 0);
  if (type === 'percent') return `${formatDecimal(value)}%`;
  return formatDecimal(value);
}

const cards = computed(() => {
  return [
    {
      label: 'Total Profit',
      live: formatMetric(props.liveMetrics.total_profit_pct, 'percent'),
      bt: formatMetric(props.btMetrics.total_profit_pct, 'percent'),
    },
    {
      label: 'Win Rate',
      live: formatMetric(props.liveMetrics.win_rate_pct, 'percent'),
      bt: formatMetric(props.btMetrics.win_rate_pct, 'percent'),
    },
    {
      label: 'Sharpe',
      live: formatMetric(props.liveMetrics.sharpe_ratio, 'number'),
      bt: formatMetric(props.btMetrics.sharpe_ratio, 'number'),
    },
    {
      label: 'Max Drawdown',
      live: formatMetric(props.liveMetrics.max_drawdown_pct, 'percent'),
      bt: formatMetric(props.btMetrics.max_drawdown_pct, 'percent'),
    },
    {
      label: 'Profit Factor',
      live: formatMetric(props.liveMetrics.profit_factor, 'number'),
      bt: formatMetric(props.btMetrics.profit_factor, 'number'),
    },
    {
      label: 'Match Rate',
      live: formatMetric(props.matchSummary.match_rate_pct, 'percent'),
      bt: 'N/A',
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
    <UCard v-for="card in cards" :key="card.label">
      <div class="text-lg font-semibold mb-2">{{ card.label }}</div>
      <div class="flex flex-col gap-1 text-start">
        <div><span class="text-surface-500">Live:</span> {{ card.live }}</div>
        <div><span class="text-surface-500">Backtest:</span> {{ card.bt }}</div>
      </div>
    </UCard>
  </div>
</template>
