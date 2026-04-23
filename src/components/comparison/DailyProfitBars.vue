<script setup lang="ts">
import type { DailyProfitBar } from '@/types';

import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  rows: DailyProfitBar[];
}>();

const chartOptions = computed<EChartsOption>(() => {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Live', 'Backtest'] },
    grid: { left: 32, right: 16, top: 36, bottom: 24 },
    xAxis: {
      type: 'category',
      data: props.rows.map((row) => row.date),
      axisLabel: { hideOverlap: true },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Live',
        type: 'bar',
        data: props.rows.map((row) => row.live_profit),
      },
      {
        name: 'Backtest',
        type: 'bar',
        data: props.rows.map((row) => row.bt_profit),
      },
    ],
  };
});
</script>

<template>
  <div class="min-h-[260px]">
    <ECharts v-if="rows.length > 0" autoresize :option="chartOptions" />
    <EmptyComparisonState
      v-else
      title="No daily profit breakdown"
      detail="The overview endpoint currently has no grouped daily PnL rows for this selection."
    />
  </div>
</template>
