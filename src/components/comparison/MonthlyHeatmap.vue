<script setup lang="ts">
import type { MonthlyHeatmapRow } from '@/types';

const props = defineProps<{
  rows: MonthlyHeatmapRow[];
}>();

const columns = [
  { accessorKey: 'year', header: 'Year' },
  { accessorKey: 'month', header: 'Month' },
  {
    accessorKey: 'live_return',
    header: 'Live Return',
    cell: ({ row }: { row: { original: MonthlyHeatmapRow } }) =>
      `${formatDecimal(row.original.live_return)}%`,
  },
  {
    accessorKey: 'bt_return',
    header: 'Backtest Return',
    cell: ({ row }: { row: { original: MonthlyHeatmapRow } }) =>
      `${formatDecimal(row.original.bt_return)}%`,
  },
];
</script>

<template>
  <UTable v-if="props.rows.length > 0" :data="props.rows" :columns="columns" />
  <EmptyComparisonState
    v-else
    title="No monthly heatmap rows"
    detail="Monthly return rows are not populated yet for the current backend response."
  />
</template>
