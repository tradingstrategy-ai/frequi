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
  <Message severity="info" class="text-start">
    <div class="font-semibold">{{ title }}</div>
    <div class="text-sm mt-1">{{ detail }}</div>
  </Message>
</template>
