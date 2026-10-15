<script setup lang="ts">
import type { PairHeatmapRow } from '@/types';
import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

/** Live vs backtest profit for the pairs where the two diverge most. */
const props = withDefaults(defineProps<{ rows: PairHeatmapRow[]; top?: number }>(), { top: 15 });

const picked = computed(() =>
  [...props.rows]
    .sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0))
    .slice(0, props.top)
    .reverse(),
);

const option = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { data: ['Live', 'Backtest'], top: 0 },
  grid: { left: 130, right: 16, top: 40, bottom: 24 },
  xAxis: { type: 'value' },
  yAxis: { type: 'category', data: picked.value.map((r) => r.pair) },
  series: [
    { name: 'Live', type: 'bar', data: picked.value.map((r) => r.live_profit) },
    { name: 'Backtest', type: 'bar', data: picked.value.map((r) => r.bt_profit) },
  ],
}));
</script>

<template>
  <div v-if="picked.length > 0">
    <ECharts
      autoresize
      :option="option"
      :style="{ height: `${Math.max(240, picked.length * 34 + 70)}px` }"
    />
  </div>
</template>
