<script setup lang="ts">
/**
 * A report table: sortable columns, a filter for long tables, and a row cap.
 *
 * Cells are gateway-built safe HTML (see `SafeHtml`); numbers sort numerically and are
 * right-aligned, and the report's colour cues (mismatch, good/bad) carry over as tones.
 */
import type { TableCell } from '@/composables/reportSections';

const props = defineProps<{
  columns: string[];
  rows: TableCell[][];
  caption?: string;
  compact?: boolean;
}>();

/** Rows rendered before "Show all"; long universe tables run to thousands of rows. */
const ROW_CAP = 50;
/** Tables longer than this get a filter box. */
const FILTER_FROM = 15;

const filter = ref('');
const showAll = ref(false);
const sortColumn = ref<number | null>(null);
const sortDescending = ref(false);

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function numeric(text: string): number | null {
  const cleaned = text.replace(/[,%$×x]|bps|USDC|USDT|USD/gi, '').trim();
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;
  return Number(cleaned);
}

const plainRows = computed(() => props.rows.map((row) => row.map((cell) => plain(cell.html))));
const numericColumns = computed(() =>
  props.columns.map((_, i) => {
    const values = plainRows.value.map((r) => r[i]).filter((v) => v && v !== '—' && v !== '-');
    return (
      values.length > 0 && values.filter((v) => numeric(v!) !== null).length / values.length > 0.8
    );
  }),
);

const ordered = computed(() => {
  let indexes = props.rows.map((_, i) => i);
  const needle = filter.value.trim().toLowerCase();
  if (needle) {
    indexes = indexes.filter((i) =>
      plainRows.value[i]!.some((v) => v.toLowerCase().includes(needle)),
    );
  }
  const column = sortColumn.value;
  if (column !== null) {
    const isNumeric = numericColumns.value[column];
    indexes.sort((a, b) => {
      const va = plainRows.value[a]![column] ?? '';
      const vb = plainRows.value[b]![column] ?? '';
      const cmp = isNumeric
        ? (numeric(va) ?? -Infinity) - (numeric(vb) ?? -Infinity)
        : va.localeCompare(vb, undefined, { numeric: true });
      return sortDescending.value ? -cmp : cmp;
    });
  }
  return indexes;
});
const shown = computed(() => (showAll.value ? ordered.value : ordered.value.slice(0, ROW_CAP)));

function sortBy(column: number) {
  if (sortColumn.value === column) {
    sortDescending.value = !sortDescending.value;
  } else {
    sortColumn.value = column;
    sortDescending.value = numericColumns.value[column] ?? false;
  }
}

const TONE_CLASSES: Record<string, string> = {
  bad: 'text-red-500 dark:text-red-400',
  good: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
  neutral: '',
};
</script>

<template>
  <div class="flex flex-col gap-1 text-start">
    <div v-if="caption" class="text-sm font-medium">{{ caption }}</div>
    <UInput
      v-if="rows.length > FILTER_FROM"
      v-model="filter"
      size="xs"
      icon="mdi:magnify"
      placeholder="Filter rows"
      class="max-w-64"
    />
    <div
      class="overflow-auto max-h-[520px] max-w-full w-fit rounded-md border border-surface-300 dark:border-surface-700"
    >
      <table class="w-full border-collapse" :class="compact ? 'text-xs' : 'text-sm'">
        <thead v-if="columns.length" class="sticky top-0 z-10 bg-surface-100 dark:bg-surface-800">
          <tr>
            <th
              v-for="(column, i) in columns"
              :key="i"
              class="px-2 py-1 font-medium text-surface-600 dark:text-surface-300 whitespace-nowrap cursor-pointer select-none border-b border-surface-300 dark:border-surface-700"
              :class="numericColumns[i] ? 'text-end' : 'text-start'"
              @click="sortBy(i)"
            >
              {{ column || ' ' }}
              <span v-if="sortColumn === i">{{ sortDescending ? '▼' : '▲' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rowIndex in shown"
            :key="rowIndex"
            class="border-b border-surface-200 dark:border-surface-800 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-900"
          >
            <!-- eslint-disable vue/no-v-html -- gateway-built safe HTML (escaped text, whitelisted tags) -->
            <td
              v-for="(cell, i) in rows[rowIndex]"
              :key="i"
              :colspan="cell.colspan"
              class="px-2 py-1 align-top"
              :class="[
                numericColumns[i] ? 'text-end tabular-nums whitespace-nowrap' : '',
                TONE_CLASSES[cell.tone ?? 'neutral'],
              ]"
              v-html="cell.html"
            />
            <!-- eslint-enable vue/no-v-html -->
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="ordered.length > ROW_CAP" class="flex items-center gap-2 text-xs text-surface-500">
      <span v-if="!showAll">Showing {{ ROW_CAP }} of {{ ordered.length }} rows.</span>
      <span v-else>Showing all {{ ordered.length }} rows.</span>
      <UButton size="xs" variant="link" @click="showAll = !showAll">
        {{ showAll ? 'Show fewer' : 'Show all' }}
      </UButton>
    </div>
    <div v-else-if="filter && !ordered.length" class="text-xs text-surface-500">No rows match.</div>
  </div>
</template>
