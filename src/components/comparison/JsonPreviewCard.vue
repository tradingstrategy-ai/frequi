<script setup lang="ts">
const props = defineProps<{
  title: string;
  payload: unknown;
  emptyText: string;
}>();

const hasContent = computed(() => {
  if (Array.isArray(props.payload)) {
    return props.payload.length > 0;
  }
  if (props.payload && typeof props.payload === 'object') {
    return Object.keys(props.payload).length > 0;
  }
  return Boolean(props.payload);
});

const formatted = computed(() => JSON.stringify(props.payload, null, 2));
</script>

<template>
  <UCard>
    <div class="text-lg font-semibold mb-2">{{ title }}</div>
    <pre v-if="hasContent" class="text-xs text-start overflow-auto max-h-[300px]">{{
      formatted
    }}</pre>
    <EmptyComparisonState v-else :title="title" :detail="emptyText" />
  </UCard>
</template>
