<script setup lang="ts">
/**
 * A Plotly chart built in the browser (traces and layout as props), redrawn on change.
 *
 * Used by the ranker admission panel; report figures use {@link ReportFigure}, which
 * fetches the report's own figure JSON instead. Emits the clicked x value.
 */
import { loadPlotly } from '@/utils/plotlyLoader';

const props = defineProps<{
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  height?: number;
}>();
const emit = defineEmits<{ pick: [x: string] }>();

const target = ref<HTMLDivElement>();
let bound = false;

async function draw() {
  const Plotly = await loadPlotly();
  if (!target.value) return;
  const layout = { ...props.layout, autosize: true, height: props.height ?? 340 };
  await Plotly.react(target.value, props.data as never, layout as never, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  });
  if (!bound) {
    bound = true;
    (
      target.value as unknown as {
        on: (e: string, f: (ev: { points: { x: unknown }[] }) => void) => void;
      }
    ).on('plotly_click', (event) => {
      const x = event.points[0]?.x;
      if (typeof x === 'string') emit('pick', x);
    });
  }
}

onMounted(draw);
watch(() => [props.data, props.layout, props.height], draw, { deep: false });

onBeforeUnmount(() => {
  // Capture the element now: the template ref is cleared before an awaited purge runs.
  const element = target.value;
  if (element) void loadPlotly().then((Plotly) => Plotly.purge(element));
});
</script>

<template>
  <div ref="target" class="w-full" :style="{ height: `${height ?? 340}px` }" />
</template>
