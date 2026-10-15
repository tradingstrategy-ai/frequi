<script setup lang="ts">
/**
 * Daily ranker admission agreement, live vs ranker replay, rebuilt from the report
 * widget's JSON payload.
 *
 * Mirrors the report's own widget: a day is compared only when both sides exist and the
 * captured settings, UTC decision time and ranking data all match and neither side is
 * reconstructed ({@link usable}); otherwise the day is "unknown", never "zero
 * admissions". Shows the stacked daily agreement, the selected day's counts and pair
 * lists, provenance, and (on request) the pair heatmap and universe turnover.
 */
import type { RankerEntry } from '@/composables/reportSections';

import PlotlyChart from './PlotlyChart.vue';

const props = defineProps<{
  title: string;
  notes: string[];
  payload: { dates: string[]; entries: RankerEntry[] };
}>();

const COLORS = { shared: '#47c999', live: '#64adff', bt: '#f5b262', missing: '#737e8c' };
type GroupKey = 'shared' | 'live' | 'bt';
const GROUPS: [string, GroupKey, string][] = [
  ['Shared', 'shared', COLORS.shared],
  ['Live only', 'live', COLORS.live],
  ['Ranker replay only', 'bt', COLORS.bt],
];

const dates = computed(() => props.payload.dates);
const sleeves = computed<[string, string][]>(() => {
  const found = [
    ...new Map(
      props.payload.entries.filter((e) => e.slug !== '*').map((e) => [e.slug, e.label ?? e.slug]),
    ).entries(),
  ];
  return found.length ? found : [['*', 'No sleeve evidence']];
});
const sleeve = ref(sleeves.value[0]![0]);
const search = ref('');
const showMore = ref(false);

function usable(e: RankerEntry | undefined): e is RankerEntry & { live: string[]; bt: string[] } {
  return (
    !!e &&
    ['PARITY', 'DIVERGED'].includes(e.status) &&
    e.live !== null &&
    e.bt !== null &&
    e.config_alignment === 'MATCHED' &&
    e.time_alignment === 'MATCHED' &&
    e.data_alignment === 'MATCHED' &&
    !(e.live_provenance as { reconstructed?: boolean } | null)?.reconstructed &&
    !(e.hist_provenance as { reconstructed?: boolean } | null)?.reconstructed
  );
}

function entryFor(day: string): RankerEntry {
  return (
    props.payload.entries.find((e) => e.slug === sleeve.value && e.day === day) ??
    props.payload.entries.find((e) => e.slug === '*' && e.day === day) ?? {
      day,
      slug: sleeve.value,
      status: 'UNAVAILABLE',
      reasons: ['No evidence for this sleeve on this day'],
      notes: [],
      live: null,
      bt: null,
    }
  );
}

function groups(e: RankerEntry): Record<GroupKey, string[]> | null {
  if (!usable(e)) return null;
  const live = new Set(e.live);
  const bt = new Set(e.bt);
  return {
    shared: e.live.filter((p) => bt.has(p)),
    live: e.live.filter((p) => !bt.has(p)),
    bt: e.bt.filter((p) => !live.has(p)),
  };
}

const entries = computed(() => dates.value.map(entryFor));
const day = ref('');
watch(
  [sleeve, entries],
  () => {
    if (!dates.value.includes(day.value) || !day.value) {
      day.value = entries.value.filter(usable).at(-1)?.day ?? dates.value.at(-1) ?? '';
    }
  },
  { immediate: true },
);

const selected = computed(() => entryFor(day.value));
const selectedGroups = computed(() => groups(selected.value));
const filtered = (pairs: string[] | null | undefined) => {
  if (!pairs) return null;
  const q = search.value.trim().toUpperCase();
  return pairs.filter((p) => p.toUpperCase().includes(q));
};

function baseLayout(title: string): Record<string, unknown> {
  return {
    title: { text: title, font: { size: 15 } },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#8b98a9', size: 12 },
    margin: { l: 50, r: 20, t: 50, b: 80 },
    legend: { orientation: 'h', y: -0.3 },
    xaxis: {
      type: 'category',
      categoryorder: 'array',
      categoryarray: dates.value,
      title: { text: 'Capture day (UTC)' },
      gridcolor: 'rgba(127,127,127,0.2)',
    },
    yaxis: { title: { text: 'Pairs' }, gridcolor: 'rgba(127,127,127,0.2)', rangemode: 'tozero' },
    shapes: [
      {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: day.value,
        x1: day.value,
        y0: 0,
        y1: 1,
        line: { color: '#9aa7b8', width: 1, dash: 'dot' },
      },
    ],
  };
}

const agreement = computed(() => {
  const es = entries.value;
  const gs = es.map(groups);
  const traces: Record<string, unknown>[] = GROUPS.map(([name, key, color]) => ({
    type: 'bar',
    name,
    x: dates.value,
    y: gs.map((g) => (g ? g[key].length : null)),
    marker: { color },
    hovertemplate: `%{x}<br>${name}: %{y} pairs<extra></extra>`,
  }));
  const unknown = es.filter((e) => !usable(e));
  traces.push({
    type: 'scatter',
    mode: 'markers',
    name: 'Unknown evidence',
    x: unknown.map((e) => e.day),
    y: unknown.map(() => 0),
    marker: { color: COLORS.missing, symbol: 'x', size: 12 },
    text: unknown.map((e) => (e.reasons ?? []).join('; ')),
    hovertemplate: '%{x}<br>Unknown — %{text}<extra></extra>',
  });
  const layout = { ...baseLayout('Daily Admission Agreement'), barmode: 'stack' };
  return { traces, layout };
});

const coverage = computed(() => {
  const es = entries.value;
  const missing = es.filter((e) => !usable(e)).map((e) => e.day);
  return (
    `${es.filter(usable).length} / ${dates.value.length} days have usable comparison evidence. ` +
    `${es.filter((e) => usable(e) && (e.notes ?? []).length).length} days have ranking notes. ` +
    (missing.length ? `Unknown: ${missing.join(', ')}. ` : '') +
    'Grey crosses mean unknown, not zero admissions.'
  );
});

function provenance(side: Record<string, unknown> | null | undefined, name: string): string {
  if (!side) return `${name}: missing`;
  const sha = side.input_snapshot_sha256 as string | undefined;
  return (
    `${name}: rank day ${side.resolved_ranking_day ?? 'unknown'} · whitelist ${side.whitelist_size ?? 'unknown'} ` +
    `(${side.whitelist_source ?? 'unknown'}${side.reconstructed ? ', reconstructed' : ''}) · decision ` +
    `${side.decision_time_utc ?? 'exact time not captured'} · Binance inputs ` +
    (sha ? `preserved ${sha.slice(0, 12)}` : 'legacy capture: not preserved')
  );
}
const cutLabel = (cut: [number, number] | null | undefined) =>
  cut ? `DVOL ${cut[0]} / ROC ${cut[1]}` : 'unknown';
const provenanceText = computed(() => {
  const e = selected.value;
  return (
    `Captured settings: ${e.config_alignment ?? 'UNKNOWN'} · UTC decision time: ${e.time_alignment ?? 'UNKNOWN'} · ` +
    `Ranking data: ${e.data_alignment ?? 'UNKNOWN'} · ${day.value} · ${provenance(e.live_provenance, 'Live')} · ` +
    `${provenance(e.hist_provenance, 'Ranker replay')} · Cuts: live ${cutLabel(e.live_cut)}; BT ${cutLabel(e.hist_cut)}`
  );
});
const warnings = computed(() =>
  [
    ...(selected.value.reasons ?? []),
    ...(selected.value.notes ?? []),
    ...(selected.value.alignment_reasons ?? []),
  ].filter(Boolean),
);

const heatmap = computed(() => {
  const es = entries.value;
  const q = search.value.trim().toUpperCase();
  const pairs = [...new Set(es.filter(usable).flatMap((e) => [...e.live!, ...e.bt!]))]
    .sort()
    .filter((p) => p.toUpperCase().includes(q));
  const labels = ['Neither', 'Both', 'Live only', 'Ranker replay only', 'Unknown evidence'];
  const z = pairs.map((p) =>
    es.map((e) =>
      !usable(e) ? 4 : e.live.includes(p) ? (e.bt.includes(p) ? 1 : 2) : e.bt.includes(p) ? 3 : 0,
    ),
  );
  const text = z.map((row, i) =>
    row.map((v, j) => `${pairs[i]}<br>${dates.value[j]} · ${labels[v]}`),
  );
  const layout = {
    ...baseLayout('Pair Admission History'),
    margin: { l: 155, r: 20, t: 50, b: 80 },
    yaxis: { autorange: 'reversed', automargin: true },
    shapes: [],
  };
  return {
    pairs,
    height: Math.max(320, pairs.length * 23 + 130),
    traces: [
      {
        type: 'heatmap',
        x: dates.value,
        y: pairs,
        z,
        text,
        zmin: 0,
        zmax: 4,
        showscale: false,
        xgap: 2,
        ygap: 2,
        hovertemplate: '%{text}<extra></extra>',
        colorscale: [
          [0, '#243244'],
          [0.124, '#243244'],
          [0.125, '#47c999'],
          [0.374, '#47c999'],
          [0.375, '#64adff'],
          [0.624, '#64adff'],
          [0.625, '#f5b262'],
          [0.874, '#f5b262'],
          [0.875, '#737e8c'],
          [1, '#737e8c'],
        ],
      },
    ],
    layout,
  };
});

interface Change {
  added?: string[];
  removed?: string[];
  reason?: string;
}
function changes(es: RankerEntry[], i: number, side: 'live' | 'bt'): Change {
  const curr = es[i]!;
  const prev = es[i - 1];
  if (!usable(curr)) return { reason: 'Current evidence unavailable' };
  if (!prev) return { reason: 'First day — no baseline' };
  const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
  if (dayMs(curr.day) - dayMs(prev.day) !== 86_400_000 || !usable(prev)) {
    return { reason: 'Previous calendar day unavailable' };
  }
  const prefix = side === 'live' ? 'live' : 'hist';
  const cutKey = `${prefix}_cut` as 'live_cut' | 'hist_cut';
  const provKey = `${prefix}_provenance` as 'live_provenance' | 'hist_provenance';
  if (
    JSON.stringify(curr[cutKey]) !== JSON.stringify(prev[cutKey]) ||
    (curr[provKey] as { build_key?: string } | null)?.build_key !==
      (prev[provKey] as { build_key?: string } | null)?.build_key
  ) {
    return { reason: 'Cut or build changed — no comparable baseline' };
  }
  const now = new Set(curr[side]);
  const before = new Set(prev[side]);
  return {
    added: [...now].filter((p) => !before.has(p)),
    removed: [...before].filter((p) => !now.has(p)),
  };
}

const turnover = computed(() => {
  const es = entries.value;
  const ls = es.map((_, i) => changes(es, i, 'live'));
  const bs = es.map((_, i) => changes(es, i, 'bt'));
  const specs: [string, Change[], 'added' | 'removed', string, number][] = [
    ['Live added', ls, 'added', COLORS.live, 1],
    ['Live removed', ls, 'removed', COLORS.live, -1],
    ['Ranker replay added', bs, 'added', COLORS.bt, 1],
    ['Ranker replay removed', bs, 'removed', COLORS.bt, -1],
  ];
  const traces: Record<string, unknown>[] = specs.map(([name, rs, key, color, sign]) => ({
    type: 'bar',
    name,
    x: dates.value,
    y: rs.map((r) => (r[key] ? r[key]!.length * sign : null)),
    marker: { color, opacity: sign > 0 ? 1 : 0.55 },
    text: rs.map((r) => (r[key] ? r[key]!.join('<br>') : (r.reason ?? ''))),
    hovertemplate: `%{x}<br>${name}: %{y}<br>%{text}<extra></extra>`,
  }));
  const gaps = es.filter((_, i) => ls[i]!.reason || bs[i]!.reason);
  traces.push({
    type: 'scatter',
    mode: 'markers',
    name: 'No baseline',
    x: gaps.map((e) => e.day),
    y: gaps.map(() => 0),
    marker: { color: COLORS.missing, symbol: 'x', size: 12 },
    hovertemplate: '%{x}<br>No comparable turnover baseline<extra></extra>',
  });
  const layout = { ...baseLayout('Daily Universe Turnover'), barmode: 'group' };
  const i = dates.value.indexOf(day.value);
  const a = ls[i];
  const b = bs[i];
  return {
    traces,
    layout,
    note:
      `${day.value} · Live: ${a?.reason ?? `compared with ${dates.value[i - 1]}`} · ` +
      `Ranker replay: ${b?.reason ?? `compared with ${dates.value[i - 1]}`}`,
    lists: [
      ['Live added', a?.added, COLORS.live],
      ['Live removed', a?.removed, COLORS.live],
      ['Ranker replay added', b?.added, COLORS.bt],
      ['Ranker replay removed', b?.removed, COLORS.bt],
    ] as [string, string[] | undefined, string][],
  };
});

function pick(x: string) {
  if (dates.value.includes(x)) day.value = x;
}
</script>

<template>
  <div class="flex flex-col gap-3 text-start" data-testid="ranker-admission">
    <h5 class="font-semibold text-sm">{{ title }}</h5>
    <!-- eslint-disable vue/no-v-html -- gateway-built safe HTML -->
    <p v-for="(note, i) in notes" :key="i" class="text-sm text-surface-500" v-html="note" />
    <!-- eslint-enable vue/no-v-html -->
    <div class="flex flex-wrap gap-3 items-end">
      <label class="flex flex-col gap-1 text-xs text-surface-500">
        Sleeve
        <USelect
          v-model="sleeve"
          :items="sleeves.map(([value, label]) => ({ value, label }))"
          class="min-w-48"
        />
      </label>
      <label class="flex flex-col gap-1 text-xs text-surface-500">
        Selected day (UTC)
        <USelect v-model="day" :items="dates" class="min-w-36" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-surface-500">
        Find a pair in lists and heatmap
        <UInput v-model="search" placeholder="e.g. BTC" class="min-w-48" />
      </label>
    </div>
    <p class="text-sm text-surface-500">{{ coverage }}</p>
    <PlotlyChart :data="agreement.traces" :layout="agreement.layout" @pick="pick" />
    <p class="text-xs text-surface-500">
      Click a day to inspect its pair lists. Counts cover the full sleeve; pair search filters the
      lists and heatmap.
    </p>
    <div class="grid gap-2 md:grid-cols-3">
      <div
        v-for="[name, key, color] in GROUPS"
        :key="key"
        class="rounded-md border border-surface-300 dark:border-surface-700 p-3"
      >
        <div class="text-sm">{{ name }}</div>
        <div class="text-2xl font-semibold" :style="{ color }">
          {{ selectedGroups ? selectedGroups[key].length : 'Unknown' }}
        </div>
        <div class="mt-2 max-h-40 overflow-auto text-xs leading-6">
          <template v-if="selectedGroups">
            <span
              v-for="pair in filtered(selectedGroups[key])"
              :key="pair"
              class="inline-block rounded border border-surface-300 dark:border-surface-700 px-1 me-1 mb-1"
              >{{ pair }}</span
            >
            <span v-if="!filtered(selectedGroups[key])?.length" class="text-surface-500">
              {{ selectedGroups[key].length ? 'No pairs match your search' : 'None' }}
            </span>
          </template>
          <span v-else class="text-surface-500">Unknown — comparison evidence unavailable</span>
        </div>
      </div>
    </div>
    <p class="text-xs text-surface-500">{{ provenanceText }}</p>
    <p v-if="warnings.length" class="text-xs text-amber-600 whitespace-pre-wrap">
      {{ warnings.join('\n') }}
    </p>
    <details
      class="rounded-md border border-surface-300 dark:border-surface-700"
      @toggle="showMore = ($event.target as HTMLDetailsElement).open"
    >
      <summary class="cursor-pointer px-3 py-2 text-sm font-medium">
        More info — Admission Heatmap &amp; Universe Turnover
      </summary>
      <div v-if="showMore" class="p-3 flex flex-col gap-3">
        <h5 class="font-semibold text-sm">Admission Heatmap</h5>
        <p class="text-xs text-surface-500">
          Every pair admitted on at least one usable day, for this sleeve. Click a column to select
          its day.
          {{
            heatmap.pairs.length
              ? `${heatmap.pairs.length} pairs shown. Unknown days carry no membership verdict.`
              : search
                ? 'No admitted pairs match your search.'
                : 'No admitted pairs in usable evidence; consult the daily counts and audit details.'
          }}
        </p>
        <div v-if="heatmap.pairs.length" class="max-h-[640px] overflow-auto">
          <PlotlyChart
            :data="heatmap.traces"
            :layout="heatmap.layout"
            :height="heatmap.height"
            @pick="pick"
          />
        </div>
        <h5 class="font-semibold text-sm">Universe Turnover</h5>
        <p class="text-xs text-surface-500">
          Added pairs are above zero; removed pairs are below zero. Each side is compared with the
          previous calendar day, using the same cut and build. The first day, evidence gaps and
          cut/build changes have no turnover baseline.
        </p>
        <PlotlyChart :data="turnover.traces" :layout="turnover.layout" @pick="pick" />
        <p class="text-xs text-surface-500">{{ turnover.note }}</p>
        <div class="grid gap-2 md:grid-cols-4">
          <div
            v-for="[name, pairs, color] in turnover.lists"
            :key="name"
            class="rounded-md border border-surface-300 dark:border-surface-700 p-2"
          >
            <div class="text-sm font-medium" :style="{ color }">
              {{ name }}{{ pairs ? ` (${pairs.length})` : '' }}
            </div>
            <div class="mt-1 max-h-40 overflow-auto text-xs leading-6">
              <template v-if="pairs">
                <span
                  v-for="pair in filtered(pairs)"
                  :key="pair"
                  class="inline-block rounded border border-surface-300 dark:border-surface-700 px-1 me-1 mb-1"
                  >{{ pair }}</span
                >
                <span v-if="!pairs.length" class="text-surface-500">None</span>
              </template>
              <span v-else class="text-surface-500">No comparable baseline</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>
