<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    detail?: string;
  }>(),
  {
    title: 'No comparison data available',
    detail: 'The comparison backend returned no data for the current bot and timerange.',
  },
);
</script>

<template>
  <UAlert color="info" class="text-start" :title="title">
    <template #description>
      <div class="text-sm">{{ detail }}</div>
    </template>
  </UAlert>
</template>
