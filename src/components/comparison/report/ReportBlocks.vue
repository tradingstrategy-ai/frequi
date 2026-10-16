<script setup lang="ts">
/**
 * Renders a list of report blocks (text, callouts, stat cards, tables, collapsible
 * groups, trade cards, figures, the ranker widget), recursing into nested blocks.
 *
 * Collapsed `details` render their content only once opened, so a section with dozens of
 * per-pair overlays costs nothing until one is expanded.
 */
import { reportFileUrl, type ReportBlock } from '@/composables/reportSections';

import RankerAdmission from './RankerAdmission.vue';
import ReportFigure from './ReportFigure.vue';
import ReportTable from './ReportTable.vue';

defineOptions({ name: 'ReportBlocks' });

const props = defineProps<{
  blocks: ReportBlock[];
  botId: string;
  report?: string;
}>();

/** Links to files next to the report (`<a data-file>` from the gateway) open in a new tab. */
function openFileLink(event: MouseEvent) {
  const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-file]');
  const name = link?.dataset.file;
  if (!name) return;
  event.preventDefault();
  // Nested block lists carry the same handler: open once, at the innermost list.
  event.stopPropagation();
  window.open(reportFileUrl(props.botId, props.report, name), '_blank', 'noopener');
}

const opened = ref(new Set<number>());
/** Linked charts (trade card -> pair overlay) the reader expanded. */
const shownLinks = ref(new Set<number>());

function toggleLink(index: number) {
  const next = new Set(shownLinks.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  shownLinks.value = next;
}

function toggle(index: number, event: Event) {
  const isOpen = (event.target as HTMLDetailsElement).open;
  const next = new Set(opened.value);
  if (isOpen) next.add(index);
  else next.delete(index);
  opened.value = next;
}

const CALLOUT_CLASSES: Record<string, string> = {
  bad: 'border-red-500/60 bg-red-500/5',
  warn: 'border-amber-500/60 bg-amber-500/5',
  good: 'border-green-500/60 bg-green-500/5',
  info: 'border-sky-500/60 bg-sky-500/5',
  neutral: 'border-surface-400 bg-surface-500/5',
};
const VALUE_CLASSES: Record<string, string> = {
  bad: 'text-red-500 dark:text-red-400',
  good: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  neutral: '',
  info: 'text-sky-600 dark:text-sky-400',
};
</script>

<template>
  <div class="report-html flex flex-col gap-3 text-start min-w-0" @click="openFileLink">
    <template v-for="(block, index) in blocks" :key="index">
      <template v-if="block.type === 'heading'">
        <h4 v-if="block.level <= 3" class="font-semibold text-base mt-2">{{ block.text }}</h4>
        <h5 v-else class="font-semibold text-sm mt-1">{{ block.text }}</h5>
      </template>

      <!-- eslint-disable vue/no-v-html -- gateway-built safe HTML (escaped text, whitelisted tags) -->
      <p
        v-else-if="block.type === 'text'"
        class="text-sm leading-relaxed"
        :class="[
          block.muted ? 'text-surface-500' : '',
          block.tone === 'bad' ? 'text-red-500' : block.tone === 'warn' ? 'text-amber-600' : '',
        ]"
        v-html="block.html"
      />
      <!-- eslint-enable vue/no-v-html -->

      <div
        v-else-if="block.type === 'callout'"
        class="rounded-md border-l-4 border px-3 py-2"
        :class="CALLOUT_CLASSES[block.tone] ?? CALLOUT_CLASSES.info"
      >
        <ReportBlocks :blocks="block.blocks" :bot-id="botId" :report="report" />
      </div>

      <div
        v-else-if="block.type === 'cards'"
        class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
      >
        <div
          v-for="(card, i) in block.items"
          :key="i"
          class="rounded-md border border-surface-300 dark:border-surface-700 px-3 py-2"
        >
          <div class="text-xs text-surface-500">{{ card.label }}</div>
          <div
            class="text-lg font-semibold tabular-nums"
            :class="VALUE_CLASSES[card.tone ?? 'neutral']"
          >
            {{ card.value }}
          </div>
        </div>
      </div>

      <ReportTable
        v-else-if="block.type === 'table'"
        :columns="block.columns"
        :rows="block.rows"
        :caption="block.caption"
        :compact="block.compact"
      />

      <!-- eslint-disable vue/no-v-html -- gateway-built safe HTML -->
      <ul v-else-if="block.type === 'list'" class="list-disc ps-5 text-sm flex flex-col gap-1">
        <li v-for="(item, i) in block.items" :key="i" v-html="item" />
      </ul>
      <!-- eslint-enable vue/no-v-html -->

      <details
        v-else-if="block.type === 'details'"
        :open="block.open"
        class="rounded-md border border-surface-300 dark:border-surface-700"
        data-testid="report-details"
        @toggle="toggle(index, $event)"
      >
        <!-- eslint-disable vue/no-v-html -- gateway-built safe HTML -->
        <summary
          class="cursor-pointer select-none px-3 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 rounded-md"
          v-html="block.summary"
        />
        <!-- eslint-enable vue/no-v-html -->
        <div v-if="opened.has(index) || block.open" class="p-3">
          <ReportBlocks :blocks="block.blocks" :bot-id="botId" :report="report" />
        </div>
      </details>

      <div
        v-else-if="block.type === 'group'"
        class="rounded-md border border-surface-300 dark:border-surface-700 p-3 flex flex-col gap-2"
        data-testid="report-group"
      >
        <div class="font-semibold text-sm">{{ block.title }}</div>
        <ReportBlocks :blocks="block.blocks" :bot-id="botId" :report="report" />
      </div>

      <ReportFigure
        v-else-if="block.type === 'figure'"
        :bot-id="botId"
        :report="report"
        :figure-id="block.id"
        :title="block.title"
        :height="block.height"
        :bytes="block.bytes"
      />

      <div
        v-else-if="block.type === 'anchor-figure'"
        class="flex flex-col gap-2"
        data-testid="report-linked-figure"
      >
        <UButton
          size="xs"
          variant="outline"
          class="self-start"
          :icon="shownLinks.has(index) ? 'mdi:chevron-up' : 'mdi:chart-line'"
          @click="toggleLink(index)"
        >
          {{ shownLinks.has(index) ? 'Hide' : block.label }}
        </UButton>
        <template v-if="shownLinks.has(index)">
          <ReportFigure
            v-for="linked in block.figures"
            :key="linked.id"
            :bot-id="botId"
            :report="report"
            :figure-id="linked.id"
            :title="linked.title"
            :height="null"
            :bytes="linked.bytes"
          />
        </template>
      </div>

      <RankerAdmission
        v-else-if="block.type === 'ranker'"
        :title="block.title"
        :notes="block.notes"
        :payload="block.payload"
      />
    </template>
  </div>
</template>

<style scoped>
/* Classes the gateway may put on inline <span>s in report HTML. */
.report-html :deep(.badge) {
  display: inline-block;
  padding: 0 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.report-html :deep(.badge-green) {
  background: rgb(34 197 94 / 0.18);
  color: rgb(22 163 74);
}
.report-html :deep(.badge-red) {
  background: rgb(239 68 68 / 0.18);
  color: rgb(220 38 38);
}
.report-html :deep(.badge-yellow) {
  background: rgb(245 158 11 / 0.18);
  color: rgb(217 119 6);
}
.report-html :deep(.badge-blue) {
  background: rgb(56 139 253 / 0.18);
  color: rgb(37 99 235);
}
.report-html :deep(.count-badge) {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  background: rgb(127 127 127 / 0.18);
}
.report-html :deep(.muted) {
  opacity: 0.7;
}
.report-html :deep(.mismatch),
.report-html :deep(.bad) {
  color: rgb(239 68 68);
}
.report-html :deep(.good) {
  color: rgb(34 197 94);
}
.report-html :deep(.warn) {
  color: rgb(217 119 6);
}
.report-html :deep(a[data-file]) {
  color: rgb(56 139 253);
  text-decoration: underline;
  cursor: pointer;
}
.report-html :deep(code) {
  font-size: 0.8em;
  padding: 0 0.2rem;
  border-radius: 0.2rem;
  background: rgb(127 127 127 / 0.15);
}
</style>
