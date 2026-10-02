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

function withUnknownDirection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withUnknownDirection);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      key === 'direction' && child === null ? 'Unknown' : withUnknownDirection(child),
    ]));
  }
  return value;
}

const formatted = computed(() => JSON.stringify(withUnknownDirection(props.payload), null, 2));
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
