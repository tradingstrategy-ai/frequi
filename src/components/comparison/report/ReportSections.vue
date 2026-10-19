<script setup lang="ts">
/**
 * The daily report's sections that belong to one Compare tab, rendered natively.
 *
 * Every heading of the bot's live-vs-backtest report is assigned to exactly one tab by
 * the gateway, so across the tabs the whole report is shown. Multi-strategy bundles have
 * one report per strategy plus an "All strategies" report; the selector switches between
 * them for every tab at once.
 */
import {
  REPORT_TAB_LABELS,
  type ReportChunk,
  type ReportTab,
  useReportSections,
} from '@/composables/reportSections';

import { useComparisonStore } from '@/stores/comparisonStore';
import ReportBlocks from './ReportBlocks.vue';

const props = withDefaults(
  defineProps<{
    tab: ReportTab;
    /** Heading above the sections (tabs that also show native comparison data use it). */
    heading?: string;
  }>(),
  { heading: 'From the daily live-vs-backtest report' },
);

const comparisonStore = useComparisonStore();
const { botId, data, chunks, loading, error, selectReport } = useReportSections(() => props.tab);

interface ChunkGroup {
  /** The report section heading. */
  title: string;
  /** Content directly under the section heading, before its first sub-section. */
  intro: ReportChunk | null;
  /** Sub-sections, each its own card. */
  children: ReportChunk[];
}

/** Sub-sections listed under their section heading, as in the report. */
const grouped = computed(() => {
  const out: ChunkGroup[] = [];
  for (const chunk of chunks.value) {
    const last = out.at(-1);
    if (chunk.level !== 3) {
      out.push({ title: chunk.title, intro: chunk, children: [] });
    } else if (last && last.title === chunk.parent) {
      last.children.push(chunk);
    } else {
      out.push({ title: chunk.parent ?? chunk.title, intro: null, children: [chunk] });
    }
  }
  return out;
});

/** The Compare header's strategy dropdown already chooses the report for bots that have one. */
const hasStrategySelector = computed(
  () => (comparisonStore.activeComparisonBot?.sleeves.length ?? 0) > 1,
);
const reportOptions = computed(() =>
  (data.value?.reports ?? []).map((r) => ({ value: r.key, label: r.title })),
);
const otherTabs = computed(() =>
  Object.entries(data.value?.tabs ?? {})
    .filter(([tab, count]) => tab !== props.tab && count > 0)
    .map(([tab]) => REPORT_TAB_LABELS[tab as ReportTab]),
);
const withheld = computed(() =>
  data.value && !['OK', 'NO_REPORT'].includes(data.value.status) ? data.value : null,
);
</script>

<template>
  <section class="flex flex-col gap-3" data-testid="report-sections" :data-tab="tab">
    <div
      class="flex flex-wrap items-center gap-2 border-t border-surface-300 dark:border-surface-700 pt-3"
    >
      <h3 class="text-lg font-semibold me-auto text-start">{{ heading }}</h3>
      <USelect
        v-if="reportOptions.length > 1 && !hasStrategySelector"
        :model-value="data?.report"
        :items="reportOptions"
        class="min-w-56"
        data-testid="report-selector"
        @update:model-value="selectReport"
      />
    </div>
    <div v-if="loading && !data" class="flex items-center gap-2 text-sm text-surface-500">
      <UIcon name="mdi:loading" class="w-5 h-5 animate-spin" /> Reading the report…
    </div>
    <UAlert v-else-if="error" color="warning" class="text-start" :title="error" />
    <UAlert
      v-else-if="withheld"
      color="warning"
      class="text-start"
      :title="`The report is withheld (${withheld.status})`"
      :description="withheld.reason || 'The central validation gate did not accept this report.'"
    />
    <UAlert
      v-else-if="data?.status === 'NO_REPORT'"
      color="info"
      class="text-start"
      title="No daily report for this bot"
      :description="data.reason || undefined"
    />
    <div
      v-else-if="data && !chunks.length"
      class="text-sm text-surface-500 text-start"
      data-testid="report-sections-empty"
    >
      This report has no {{ REPORT_TAB_LABELS[tab] }} sections.
      <template v-if="otherTabs.length">It has sections under {{ otherTabs.join(', ') }}.</template>
    </div>
    <template v-for="(group, gi) in grouped" :key="gi">
      <UCard
        v-if="!group.children.length && group.intro"
        :data-testid="`report-chunk-${group.intro.id}`"
        class="min-w-0"
      >
        <div class="font-semibold text-start mb-2">{{ group.title }}</div>
        <ReportBlocks :blocks="group.intro.blocks" :bot-id="botId" :report="data?.report" />
      </UCard>
      <template v-else>
        <h4 class="text-base font-semibold text-start mt-1">{{ group.title }}</h4>
        <UCard v-if="group.intro" :data-testid="`report-chunk-${group.intro.id}`" class="min-w-0">
          <ReportBlocks :blocks="group.intro.blocks" :bot-id="botId" :report="data?.report" />
        </UCard>
        <UCard
          v-for="chunk in group.children"
          :key="chunk.id"
          :data-testid="`report-chunk-${chunk.id}`"
          class="min-w-0"
        >
          <div class="font-semibold text-start mb-2">{{ chunk.title }}</div>
          <ReportBlocks :blocks="chunk.blocks" :bot-id="botId" :report="data?.report" />
        </UCard>
      </template>
    </template>
  </section>
</template>
