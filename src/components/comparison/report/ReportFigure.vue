<script setup lang="ts">
/**
 * One Plotly chart from the daily report, drawn from the report's own figure data.
 *
 * The figure JSON is fetched only when the chart scrolls into view, and plotly.js is a
 * lazily loaded chunk, so a tab with dozens of charts costs nothing until it is read.
 * Charts above {@link AUTO_LOAD_LIMIT_BYTES} wait for a click: plotting tens of MB of
 * candles blocks the page for seconds.
 */
import {
  fetchReportFigure,
  isEmptyFigure,
  type PlotlyFigureJson,
} from '@/composables/reportSections';
import { loadPlotly } from '@/utils/plotlyLoader';

const props = defineProps<{
  botId: string;
  report?: string;
  figureId: string;
  title: string;
  height: number | null;
  bytes?: number;
}>();

/** Charts larger than this load on request (see component doc). */
const AUTO_LOAD_LIMIT_BYTES = 8 * 1024 * 1024;

const target = ref<HTMLDivElement>();
const wrapper = ref<HTMLDivElement>();
const state = ref<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
const error = ref('');
const confirmed = ref((props.bytes ?? 0) <= AUTO_LOAD_LIMIT_BYTES);
const visible = ref(false);
/** Height from the report's div, else from the figure's own layout once fetched. */
const layoutHeight = ref<number | null>(null);
const chartHeight = computed(() =>
  Math.min(Math.max(props.height ?? layoutHeight.value ?? 450, 260), 1600),
);
const sizeLabel = computed(() => `${((props.bytes ?? 0) / 1024 / 1024).toFixed(1)} MB`);

const { stop } = useIntersectionObserver(
  wrapper,
  ([entry]) => {
    if (entry?.isIntersecting) {
      visible.value = true;
      stop();
    }
  },
  { rootMargin: '400px' },
);

async function draw() {
  if (state.value !== 'idle' || !confirmed.value || !visible.value) return;
  state.value = 'loading';
  try {
    const [Plotly, figure] = await Promise.all([
      loadPlotly(),
      fetchReportFigure(props.botId, props.report, props.figureId),
    ]);
    if (isEmptyFigure(figure)) {
      state.value = 'empty';
      return;
    }
    if (typeof figure.layout.height === 'number') layoutHeight.value = figure.layout.height;
    await nextTick();
    if (!target.value) return;
    const layout = adaptLayout(figure);
    await Plotly.newPlot(target.value, figure.data as never, layout as never, {
      responsive: true,
      displaylogo: false,
    });
    state.value = 'ready';
  } catch (e) {
    state.value = 'error';
    error.value = e instanceof Error ? e.message : String(e);
  }
}

/** The report's layout, sized to the dashboard card instead of a fixed page width. */
function adaptLayout(figure: PlotlyFigureJson): Record<string, unknown> {
  const layout = { ...figure.layout };
  delete layout.width;
  layout.autosize = true;
  layout.height = chartHeight.value;
  return layout;
}

watch([visible, confirmed], draw);

onBeforeUnmount(() => {
  // Capture the element now: the template ref is cleared before an awaited purge runs.
  const element = target.value;
  if (state.value === 'ready' && element) {
    void loadPlotly().then((Plotly) => Plotly.purge(element));
  }
});
</script>

<template>
  <div ref="wrapper" class="w-full" data-testid="report-figure" :data-state="state">
    <div
      v-if="!confirmed"
      class="flex flex-col items-start gap-2 rounded-md border border-dashed border-surface-400 p-4 text-start text-sm"
      :style="{ minHeight: '120px' }"
    >
      <div class="font-medium">{{ title || 'Chart' }}</div>
      <div class="text-surface-500">
        This chart carries {{ sizeLabel }} of data and can take a few seconds to draw.
      </div>
      <UButton size="sm" icon="mdi:chart-line" @click="confirmed = true">Load chart</UButton>
    </div>
    <div
      v-else-if="state === 'empty'"
      class="rounded-md border border-dashed border-surface-400 p-4 text-start text-sm text-surface-500"
      data-testid="report-figure-empty"
    >
      {{ title || 'This chart' }}: no data for this report or strategy in the window.
    </div>
    <div v-else class="relative w-full" :style="{ height: `${chartHeight}px` }">
      <div ref="target" class="w-full h-full" />
      <div
        v-if="state === 'idle' || state === 'loading'"
        class="absolute inset-0 flex items-center justify-center text-surface-500 text-sm"
      >
        <UIcon name="mdi:loading" class="w-6 h-6 animate-spin me-2" />
        Loading {{ title || 'chart' }}…
      </div>
      <UAlert
        v-if="state === 'error'"
        color="warning"
        class="absolute inset-x-0 top-0 text-start"
        :title="`Could not draw ${title || 'this chart'}`"
        :description="error"
      />
    </div>
  </div>
</template>
