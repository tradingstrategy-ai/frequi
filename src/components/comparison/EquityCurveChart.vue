<script setup lang="ts">
import type { EquityCurveData } from '@/types';

import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([LineChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  equityCurve: EquityCurveData;
  mode?: 'percent' | 'share_price' | 'account_balance';
}>();

const displayMode = computed(() => props.mode ?? 'percent');

const hasData = computed(
  () => [...props.equityCurve.live, ...props.equityCurve.bt].some((point) => point.value !== null),
);

const chartOptions = computed<EChartsOption>(() => {
  const labels = Array.from(
    new Set([
      ...props.equityCurve.live.map((point) => point.date),
      ...props.equityCurve.bt.map((point) => point.date),
    ]),
  ).sort();

  const liveMap = new Map(props.equityCurve.live.map((point) => [point.date, point.value]));
  const btMap = new Map(props.equityCurve.bt.map((point) => [point.date, point.value]));

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Live', 'Backtest'] },
    grid: { left: 32, right: 16, top: 36, bottom: 24 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      name: displayMode.value === 'account_balance'
        ? 'Account Balance'
        : displayMode.value === 'share_price' ? 'Share Price' : 'Profit %',
      axisLabel: {
        formatter: (value: number) => {
          if (displayMode.value === 'account_balance') {
            return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
          }
          return displayMode.value === 'share_price' ? value.toFixed(4) : `${value}%`;
        },
      },
    },
    series: [
      {
        name: 'Live',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: labels.map((label) => liveMap.get(label) ?? null),
      },
      {
        name: 'Backtest',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: labels.map((label) => btMap.get(label) ?? null),
      },
    ],
  };
});
</script>

<template>
  <div class="h-[280px]">
    <ECharts v-if="hasData" class="h-full w-full" autoresize :option="chartOptions" />
    <EmptyComparisonState
      v-else
      title="No equity curve data"
      detail="No account balance points are available for this report view."
    />
  </div>
</template>
