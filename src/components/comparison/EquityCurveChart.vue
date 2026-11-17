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

const hasData = computed(() =>
  [...props.equityCurve.live, ...props.equityCurve.bt].some((point) => point.value !== null),
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
    legend: { data: ['Live', 'Backtest'], top: 0 },
    grid: { left: 64, right: 16, top: 40, bottom: 28 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        hideOverlap: true,
        // "2026-10-03T04:00:09.750000+00:00" -> "2026-10-03"
        formatter: (value: string) => value.slice(0, 10),
      },
    },
    yAxis: {
      type: 'value',
      // Realized balances move a few percent; an axis forced to 0 flattens the curves.
      scale: true,
      name:
        displayMode.value === 'account_balance'
          ? 'Account Balance'
          : displayMode.value === 'share_price'
            ? 'Share Price'
            : 'Profit %',
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
        // Balance changes at trade close and holds in between; the two series sample
        // different timestamps, so null points are bridged rather than drawn as dots.
        step: 'end',
        connectNulls: true,
        showSymbol: false,
        data: labels.map((label) => liveMap.get(label) ?? null),
      },
      {
        name: 'Backtest',
        type: 'line',
        step: 'end',
        connectNulls: true,
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
