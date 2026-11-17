<script setup lang="ts">
/**
 * A titled table for comparison rows, with number formatting and a row cap.
 *
 * Replaces the raw-JSON preview cards: the comparison endpoints return plain rows, so a
 * page only declares which keys to show and how to format them.
 */
type Format = 'text' | 'int' | 'num' | 'pct';

interface ColumnSpec {
  key: string;
  label: string;
  format?: Format;
}

const props = withDefaults(
  defineProps<{
    title: string;
    rows: Record<string, unknown>[];
    columns: ColumnSpec[];
    /** Rows rendered; the rest are summarised in a footnote. */
    limit?: number;
    emptyText?: string;
    subtitle?: string;
  }>(),
  { limit: 100, emptyText: 'No rows for this selection.', subtitle: '' },
);

function format(value: unknown, kind: Format = 'text'): string {
  if (value === null || value === undefined || value === '' || value === 'nan') return '—';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    if (kind === 'int') return value.toFixed(0);
    if (kind === 'pct') return `${value.toFixed(2)}%`;
    if (kind === 'num') return value.toFixed(2);
  }
  return String(value);
}

const shown = computed(() =>
  props.rows.slice(0, props.limit).map((row) => {
    const out: Record<string, string> = {};
    props.columns.forEach((col) => {
      out[col.key] = format(row[col.key], col.format);
    });
    return out;
  }),
);
const tableColumns = computed(() =>
  props.columns.map((col) => ({ accessorKey: col.key, header: col.label })),
);
</script>

<template>
  <UCard>
    <div class="text-lg font-semibold">{{ title }}</div>
    <div v-if="subtitle" class="text-sm text-surface-500 mb-2 text-start">{{ subtitle }}</div>
    <UTable
      v-if="rows.length > 0"
      :data="shown"
      :columns="tableColumns"
      class="max-h-[420px] overflow-auto"
    />
    <div v-else class="text-sm text-surface-500 py-3 text-start">{{ emptyText }}</div>
    <div v-if="rows.length > limit" class="text-xs text-surface-500 text-start pt-2">
      Showing the first {{ limit }} of {{ rows.length }} rows.
    </div>
  </UCard>
</template>
