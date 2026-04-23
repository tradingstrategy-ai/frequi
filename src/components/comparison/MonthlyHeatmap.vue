<script setup lang="ts">
import type { MonthlyHeatmapRow } from '@/types';

defineProps<{
  rows: MonthlyHeatmapRow[];
}>();
</script>

<template>
  <DataTable v-if="rows.length > 0" :value="rows" size="small" show-gridlines>
    <Column field="year" header="Year" />
    <Column field="month" header="Month" />
    <Column field="live_return" header="Live Return">
      <template #body="{ data }">{{ formatDecimal(data.live_return) }}%</template>
    </Column>
    <Column field="bt_return" header="Backtest Return">
      <template #body="{ data }">{{ formatDecimal(data.bt_return) }}%</template>
    </Column>
  </DataTable>
  <EmptyComparisonState
    v-else
    title="No monthly heatmap rows"
    detail="Monthly return rows are not populated yet for the current backend response."
  />
</template>
