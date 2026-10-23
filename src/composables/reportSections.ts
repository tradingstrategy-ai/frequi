import axios from 'axios';

import { getComparisonApiBase } from '@/config/presetBots';
import { useComparisonStore } from '@/stores/comparisonStore';

/**
 * The daily live-vs-backtest report of a bot, as typed sections.
 *
 * The dashboard gateway converts each report (`GET /api/comparison/<bot>/sections`) into
 * chunks, one per report heading, each assigned to a Compare tab. Figures are fetched one
 * at a time (`/figure`) because a report can carry over 100 MB of chart data.
 */

/** Compare tabs a report chunk can belong to. */
export type ReportTab = 'overview' | 'execution' | 'timeline' | 'pairs' | 'universe' | 'trades';

export type Tone = 'good' | 'bad' | 'neutral' | 'warn' | 'info';

/** Gateway-built HTML: escaped text plus attribute-free inline tags and known classes. */
export type SafeHtml = string;

export interface TableCell {
  html: SafeHtml;
  tone?: Tone;
  colspan?: number;
}

export interface RankerEntry {
  day: string;
  slug: string;
  label?: string;
  status: string;
  reasons?: string[];
  notes?: string[];
  config_alignment?: string;
  time_alignment?: string;
  data_alignment?: string;
  alignment_reasons?: string[];
  live: string[] | null;
  bt: string[] | null;
  live_cut?: [number, number] | null;
  hist_cut?: [number, number] | null;
  live_provenance?: Record<string, unknown> | null;
  hist_provenance?: Record<string, unknown> | null;
}

export type ReportBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'text'; html: SafeHtml; muted?: boolean; tone?: Tone }
  | { type: 'callout'; tone: Tone; blocks: ReportBlock[] }
  | { type: 'cards'; items: { label: string; value: string; tone?: Tone }[] }
  | { type: 'table'; columns: string[]; rows: TableCell[][]; caption?: string; compact?: boolean }
  | { type: 'list'; items: SafeHtml[] }
  | { type: 'details'; summary: SafeHtml; blocks: ReportBlock[]; open?: boolean; kind?: string }
  | { type: 'group'; title: string; blocks: ReportBlock[] }
  | { type: 'figure'; id: string; title: string; height: number | null; bytes?: number }
  | {
      /** A link to a chart elsewhere in the report (a trade card's pair overlay). */
      type: 'anchor-figure';
      label: string;
      anchor: string;
      figures: { id: string; title: string; bytes?: number }[];
    }
  | {
      type: 'ranker';
      title: string;
      notes: SafeHtml[];
      payload: { dates: string[]; entries: RankerEntry[] };
    };

export interface ReportChunk {
  id: string;
  title: string;
  level: number;
  /** Enclosing section heading for sub-sections. */
  parent: string | null;
  tab: ReportTab;
  blocks: ReportBlock[];
}

export interface ReportSourceInfo {
  key: string;
  title: string;
  bytes: number;
  /** The strategy this report covers (a multi-strategy bundle), null for the portfolio report. */
  strategy?: string | null;
}

export interface ReportSectionsResponse {
  /** `OK`, `NO_REPORT`, or the central gate status that withholds the report. */
  status: string;
  reason?: string | null;
  reports: ReportSourceInfo[];
  report?: string;
  title?: string;
  chunks: ReportChunk[];
  tabs?: Record<ReportTab, number>;
}

export interface PlotlyFigureJson {
  data: unknown[];
  layout: Record<string, unknown>;
}

/**
 * Whether a report figure has nothing to draw (no traces), as a strategy that never traded in
 * the window gets. Plotly would still draw bare axes and log an SVG error for their title.
 */
export function isEmptyFigure(figure: PlotlyFigureJson): boolean {
  return !Array.isArray(figure.data) || figure.data.length === 0;
}

export interface TradeMarker {
  side: 'bt' | 'live';
  kind: 'entry' | 'exit';
  time: string;
  price: number;
  label: string;
}

export interface TradeMarkersResponse {
  pair: string;
  status: string;
  reason?: string | null;
  report?: string;
  markers: TradeMarker[];
}

const api = axios.create({
  baseURL: getComparisonApiBase(),
  // Parsing a 170 MB report cold takes a few seconds; figures can be tens of MB.
  timeout: 120_000,
  withCredentials: false,
});

/**
 * @param report A listed report's key (wins when given).
 * @param strategy A strategy of a multi-strategy bot: its own report is read.
 */
export async function fetchReportSections(
  botId: string,
  report?: string,
  strategy?: string,
): Promise<ReportSectionsResponse> {
  const { data } = await api.get<ReportSectionsResponse>(`/${encodeURIComponent(botId)}/sections`, {
    params: { ...(report ? { report } : {}), ...(strategy ? { strategy } : {}) },
  });
  return data;
}

export async function fetchReportFigure(
  botId: string,
  report: string | undefined,
  figureId: string,
): Promise<PlotlyFigureJson> {
  const { data } = await api.get<PlotlyFigureJson>(`/${encodeURIComponent(botId)}/figure`, {
    params: { id: figureId, ...(report ? { report } : {}) },
  });
  return data;
}

export async function fetchTradeMarkers(
  botId: string,
  pair: string,
  strategy?: string,
): Promise<TradeMarkersResponse> {
  const { data } = await api.get<TradeMarkersResponse>(`/${encodeURIComponent(botId)}/markers`, {
    params: { pair, ...(strategy ? { strategy } : {}) },
  });
  return data;
}

/** URL of a file the report links to (CSV export, ranker-evidence page), via the gateway. */
export function reportFileUrl(botId: string, report: string | undefined, name: string): string {
  const query = new URLSearchParams({ name, ...(report ? { report } : {}) });
  return `${getComparisonApiBase()}/${encodeURIComponent(botId)}/file?${query.toString()}`;
}

/** Labels of the Compare tabs that show report chunks. */
export const REPORT_TAB_LABELS: Record<ReportTab, string> = {
  overview: 'Overview',
  execution: 'Execution',
  timeline: 'Timeline',
  pairs: 'Pairs & Overlays',
  universe: 'Universe & Signals',
  trades: 'Trade Detail',
};

/** Most loaded reports kept. Why: each is large; browsing many bots would grow memory unbounded. */
const SECTIONS_CACHE_SIZE = 24;

/**
 * Loaded reports, keyed by `<bot>|<report key>|<strategy>`; shared by every tab. Entries are
 * stored raw (not deeply reactive) and the oldest are dropped beyond the bound.
 */
const cache = shallowReactive(new Map<string, ReportSectionsResponse>());

function remember(key: string, value: ReportSectionsResponse) {
  cache.delete(key);
  cache.set(key, markRaw(value));
  while (cache.size > SECTIONS_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Forget a bot's loaded reports (a new daily report was published). */
export function clearReportSections(botId: string) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${botId}|`)) cache.delete(key);
  }
}
const inflight = new Map<string, Promise<ReportSectionsResponse>>();

/**
 * Sections of the Compare page's bot, for one tab.
 *
 * The selected report (one per strategy in multi-strategy bundles) is the `report`
 * query parameter, so it survives tab switches and reloads.
 */
export function useReportSections(tab: () => ReportTab | undefined) {
  const route = useRoute();
  const router = useRouter();
  const comparisonStore = useComparisonStore();
  const loading = ref(false);
  const error = ref('');

  const botId = computed(() => comparisonStore.selectedBotId);
  const requested = computed(() =>
    typeof route.query.report === 'string' ? route.query.report : '',
  );
  /** The strategy picked in the Compare header: its own report is shown. */
  const strategy = computed(() =>
    typeof route.query.sleeve === 'string' ? route.query.sleeve : comparisonStore.selectedSleeve,
  );
  const key = computed(() => `${botId.value}|${requested.value}|${strategy.value}`);
  const data = computed(() => cache.get(key.value));
  const chunks = computed(() => {
    const wanted = tab();
    return (data.value?.chunks ?? []).filter((chunk) => !wanted || chunk.tab === wanted);
  });

  async function load() {
    const bot = botId.value;
    if (!bot) return;
    const cacheKey = key.value;
    if (cache.has(cacheKey)) return;
    loading.value = true;
    error.value = '';
    try {
      let pending = inflight.get(cacheKey);
      if (!pending) {
        pending = fetchReportSections(
          bot,
          requested.value || undefined,
          strategy.value || undefined,
        );
        inflight.set(cacheKey, pending);
      }
      remember(cacheKey, await pending);
    } catch (e) {
      error.value = axios.isAxiosError(e)
        ? `Could not load the report sections (${e.response?.status ?? e.message}).`
        : 'Could not load the report sections.';
    } finally {
      inflight.delete(cacheKey);
      loading.value = false;
    }
  }

  function selectReport(report: string) {
    router.replace({ path: route.path, query: { ...route.query, report } });
  }

  watch(key, load, { immediate: true });

  return { botId, data, chunks, loading, error, selectReport, reload: load };
}
