<script setup lang="ts">
import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

/** Live vs backtest values binned on shared edges. */
const props = withDefaults(
  defineProps<{
    live: (number | null)[];
    bt: (number | null)[];
    bins?: number;
    unit?: string;
    liveLabel?: string;
    btLabel?: string;
  }>(),
  { bins: 16, unit: '', liveLabel: 'Live', btLabel: 'Backtest' },
);

const clean = (values: (number | null)[]) =>
  values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

const model = computed(() => {
  const live = clean(props.live);
  const bt = clean(props.bt);
  const all = [...live, ...bt];
  if (all.length === 0) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const width = (max - min) / props.bins || 1;
  const count = (values: number[]) => {
    const bins = Array.from({ length: props.bins }, () => 0);
    values.forEach((v) => {
      bins[Math.min(props.bins - 1, Math.floor((v - min) / width))] += 1;
    });
    return bins;
  };
  const labels = Array.from({ length: props.bins }, (_, i) => (min + i * width).toFixed(1));
  return { labels, live: count(live), bt: count(bt) };
});

const option = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: [props.liveLabel, props.btLabel], top: 0 },
  grid: { left: 40, right: 16, top: 40, bottom: 28 },
  xAxis: {
    type: 'category',
    data: model.value?.labels ?? [],
    name: props.unit,
    axisLabel: { hideOverlap: true },
  },
  yAxis: { type: 'value', minInterval: 1 },
  series: [
    { name: props.liveLabel, type: 'bar', data: model.value?.live ?? [] },
    { name: props.btLabel, type: 'bar', data: model.value?.bt ?? [] },
  ],
}));
</script>

<template>
  <div class="min-h-[240px]">
    <ECharts v-if="model" autoresize :option="option" style="height: 260px" />
    <div v-else class="text-sm text-surface-500 py-6 text-start">No values to chart.</div>
  </div>
</template>
