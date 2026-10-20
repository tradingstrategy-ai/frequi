<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';
import { REPORTS_AUTH_BOOTSTRAP_URL } from '@/utils/botAuthorization';
import { loadPlotly } from '@/utils/plotlyLoader';
import { reportCaveats, reportVerdicts, versionHistory } from '@/utils/reportVersions';

const route = useRoute();
const router = useRouter();
const botStore = useBotStore();
const { comparisonStore, activeBotId, activeBotName, activeTimerange, activeSleeve } =
  useComparison();
const timerangeInput = ref('');
const now = ref(Date.now());
let ageTimer: number | undefined;

/** Report states that carry no comparison data; shown as a banner with the reason. */
const NO_DATA_STATUSES: Record<string, { color: 'error' | 'warning' | 'info'; title: string }> = {
  FAILED: { color: 'error', title: 'The latest report run failed' },
  MISSING: { color: 'warning', title: 'No report has been produced for this bot yet' },
  INCOMPLETE: { color: 'warning', title: 'The latest report is incomplete' },
  INSUFFICIENT_HISTORY: { color: 'info', title: 'Not enough live history to compare yet' },
  NO_BACKTEST: { color: 'info', title: 'The backtest produced no trades to compare against' },
  BLIND: { color: 'warning', title: "The report could not see this bot's live data" },
  NOT_VALIDATED: { color: 'warning', title: 'This report has not been validated' },
};
const statusNotice = computed(() => {
  const status = comparisonStore.report?.status;
  return status ? NO_DATA_STATUSES[status] : undefined;
});

/** The navbar bot, when it is a Compare bot that has numbers to show. */
function navbarBotWithData(): string {
  const id = botStore.selectedBot;
  const bot = comparisonStore.supportedBots.find((b) => b.bot_id === id);
  return bot?.report.status === 'SUCCESS' ? id : '';
}

const navItems = [
  { label: 'Overview', to: '/compare/overview' },
  { label: 'Execution', to: '/compare/execution' },
  { label: 'Timeline', to: '/compare/timeline' },
  { label: 'Pairs & Overlays', to: '/compare/pairs' },
  { label: 'Universe & Signals', to: '/compare/universe' },
  { label: 'Trade Detail', to: '/compare/trades' },
  { label: 'Report', to: '/compare/report' },
];
const reportAge = computed(() => {
  const generatedAt = comparisonStore.report?.generated_at;
  if (!generatedAt) return 'unknown age';
  const elapsed = Math.max(0, now.value - Date.parse(generatedAt));
  if (!Number.isFinite(elapsed)) return 'unknown age';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m old`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
});
const generatedAtUtc = computed(() => {
  const generatedAt = comparisonStore.report?.generated_at;
  if (!generatedAt) return '';
  const timestamp = Date.parse(generatedAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : generatedAt;
});
const reportWindowText = computed(() => {
  const window = comparisonStore.report?.report_window;
  return window ? `${window.start} to ${window.end}` : '';
});
const verdicts = computed(() => reportVerdicts(comparisonStore.report));
const caveats = computed(() => reportCaveats(comparisonStore.report));
const annotationText = computed(() =>
  caveats.value.map(({ code, note }) => `${code}: ${note}`).join(' · '),
);
const versions = computed(() => versionHistory(comparisonStore.report));
/** The Report tab, opened on the full-history report (its changelog is at the top). */
const fullHistoryLink = computed(() =>
  versions.value?.historyReport
    ? { path: '/compare/report', query: { ...route.query, file: versions.value.historyReport } }
    : null,
);

function updateQuery(extra: Record<string, string | undefined>) {
  router.replace({ path: route.path, query: { ...route.query, ...extra } });
}

function applyTimerange() {
  const value = timerangeInput.value.trim();
  comparisonStore.setTimerange(value);
  updateQuery({ timerange: value || undefined });
}

function selectBot(botId: string) {
  comparisonStore.setSelectedBot(botId);
  updateQuery({
    bot: botId,
    sleeve: comparisonStore.selectedSleeve || undefined,
    // Report keys (per-strategy files) belong to one bot.
    report: undefined,
  });
}

function selectSleeve(sleeve: string) {
  comparisonStore.setSelectedSleeve(sleeve);
  // A strategy picked here replaces any report chosen before.
  updateQuery({ sleeve: sleeve || undefined, report: undefined });
}

/** Sentinel for "no strategy filter": a select item cannot have an empty value. */
const ALL_STRATEGIES = '__all__';
const strategyItems = computed(() => {
  const bot = comparisonStore.activeComparisonBot;
  const labels = new Map((bot?.sleeve_info ?? []).map((info) => [info.id, info.label]));
  return [
    { label: 'All strategies', value: ALL_STRATEGIES },
    ...(bot?.sleeves ?? []).map((id) => ({ label: labels.get(id) ?? id, value: id })),
  ];
});

/**
 * Fetch every Compare tab's code (and plotly.js, which report sections use) right away.
 * Over plain HTTP/1.1 a browser holds six connections; fetched later, a tab's chunk can
 * queue behind slow bot polls and a click seems to do nothing.
 */
function prefetchTabs() {
  void Promise.allSettled([
    import('@/views/comparison/ReportTabView.vue'),
    import('@/views/comparison/TradeTimeline.vue'),
    import('@/views/comparison/PairCategoryAnalysis.vue'),
    import('@/views/comparison/TradeDeepDive.vue'),
    import('@/views/comparison/FleetReportTab.vue'),
    loadPlotly(),
  ]);
}

onMounted(async () => {
  prefetchTabs();
  timerangeInput.value = activeTimerange.value;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.ensureComparisonBots();
  const requestedBot = typeof route.query.bot === 'string' ? route.query.bot : '';
  if (requestedBot && comparisonStore.isSupportedBot(requestedBot)) {
    comparisonStore.setSelectedBot(requestedBot);
  } else if (requestedBot) {
    updateQuery({ bot: undefined, sleeve: undefined });
  } else if (navbarBotWithData()) {
    // Opened from the navbar: show the bot selected there. A bot without numbers is
    // not followed: the navbar's first-connected bot would otherwise open Compare blank.
    comparisonStore.setSelectedBot(navbarBotWithData());
    updateQuery({ bot: navbarBotWithData() });
  }
  const invalidRequestedBot = Boolean(
    requestedBot && !comparisonStore.isSupportedBot(requestedBot),
  );
  const requestedSleeve =
    !invalidRequestedBot && typeof route.query.sleeve === 'string'
      ? route.query.sleeve
      : invalidRequestedBot
        ? ''
        : comparisonStore.selectedSleeve;
  comparisonStore.setSelectedSleeve(requestedSleeve);
  if (requestedSleeve && comparisonStore.selectedSleeve !== requestedSleeve) {
    updateQuery({ sleeve: undefined });
  }
  ageTimer = window.setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (ageTimer !== undefined) window.clearInterval(ageTimer);
});

watch(
  () => activeTimerange.value,
  (value) => {
    timerangeInput.value = value;
    comparisonStore.setTimerange(value);
  },
);

// Picking another bot in the navbar while on a Compare page follows it.
watch(
  () => botStore.selectedBot,
  (botId) => {
    if (
      comparisonStore.supportedBotsLoaded &&
      navbarBotWithData() === botId &&
      botId !== activeBotId.value
    ) {
      selectBot(botId);
    }
  },
);

watch(
  () => route.query.sleeve,
  (value) => {
    if (!comparisonStore.supportedBotsLoaded) return;
    const requestedSleeve = typeof value === 'string' ? value : '';
    comparisonStore.setSelectedSleeve(requestedSleeve);
    if (requestedSleeve && comparisonStore.selectedSleeve !== requestedSleeve) {
      updateQuery({ sleeve: undefined });
    }
  },
);

watch(
  () => route.query.bot,
  (value) => {
    if (!comparisonStore.supportedBotsLoaded) return;
    const requestedBot = typeof value === 'string' ? value : '';
    if (!requestedBot) return;
    if (!comparisonStore.isSupportedBot(requestedBot)) {
      updateQuery({ bot: undefined, sleeve: undefined });
      return;
    }
    comparisonStore.setSelectedBot(requestedBot);
    const requestedSleeve = typeof route.query.sleeve === 'string' ? route.query.sleeve : '';
    comparisonStore.setSelectedSleeve(requestedSleeve);
    if (requestedSleeve && comparisonStore.selectedSleeve !== requestedSleeve) {
      updateQuery({ sleeve: undefined });
    }
  },
);
</script>

<template>
  <div class="flex flex-col gap-4 p-3">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div class="text-start">
        <h2 class="text-2xl font-semibold">Report Comparison</h2>
        <p class="text-surface-500">
          Selected report:
          <span class="font-medium">{{ activeBotName || 'Loading reports…' }}</span>
          <template v-if="comparisonStore.activeComparisonBot?.venue">
            · {{ comparisonStore.activeComparisonBot.venue }}</template
          >
        </p>
        <p v-if="comparisonStore.report" class="text-sm text-surface-500">
          {{ comparisonStore.report.status }} · generated {{ reportAge }}
          <template v-if="generatedAtUtc"> · as of {{ generatedAtUtc }} UTC</template>
          <template v-if="comparisonStore.report.report_date">
            · report date {{ comparisonStore.report.report_date }}</template
          >
          <template v-if="reportWindowText"> · window {{ reportWindowText }}</template>
          <template v-if="comparisonStore.report.reason">
            · {{ comparisonStore.report.reason }}</template
          >
        </p>
      </div>
      <div class="flex flex-col gap-2 md:flex-row md:items-center">
        <USelect
          :model-value="activeBotId"
          value-key="bot_id"
          label-key="display_name"
          :items="comparisonStore.supportedBots"
          class="min-w-56"
          placeholder="Choose a report"
          @update:model-value="selectBot"
        />
        <USelect
          v-if="(comparisonStore.activeComparisonBot?.sleeves.length ?? 0) > 1"
          :model-value="activeSleeve || ALL_STRATEGIES"
          :items="strategyItems"
          class="min-w-52"
          data-testid="strategy-selector"
          aria-label="Strategy"
          @update:model-value="selectSleeve($event === ALL_STRATEGIES ? '' : String($event))"
        />
        <UInput v-model="timerangeInput" class="min-w-[220px]" placeholder="YYYYMMDD-YYYYMMDD" />
        <UButton color="neutral" icon="mdi:calendar-range" @click="applyTimerange"
          >Apply timerange</UButton
        >
      </div>
    </div>

    <UAlert
      v-if="comparisonStore.authRequired"
      color="warning"
      class="text-start"
      title="Reconnect to reports"
      description="Report access requires authentication. Continue to the report service to sign in."
    >
      <template #actions>
        <a :href="REPORTS_AUTH_BOOTSTRAP_URL" class="text-primary underline">Connect to reports</a>
      </template>
    </UAlert>
    <UAlert
      v-else-if="comparisonStore.supportedBotsError"
      color="warning"
      class="text-start"
      :title="comparisonStore.supportedBotsError"
    >
      <template #actions>
        <a :href="REPORTS_AUTH_BOOTSTRAP_URL" class="text-primary underline">Connect to reports</a>
      </template>
    </UAlert>
    <UAlert
      v-if="statusNotice"
      :color="statusNotice.color"
      class="text-start"
      data-testid="report-status-notice"
      :title="`${statusNotice.title} (${comparisonStore.report?.status})`"
      :description="comparisonStore.report?.reason || 'The report service gave no reason.'"
    >
      <template #actions>
        <RouterLink to="/reports" class="text-primary underline">Fleet reports</RouterLink>
      </template>
    </UAlert>
    <UAlert
      v-if="comparisonStore.supportedBotsLoaded && comparisonStore.supportedBots.length === 0"
      color="info"
      class="text-start"
      title="No reports are available yet"
      description="The report service returned an empty comparison catalog."
    />
    <UAlert
      v-if="comparisonStore.report && comparisonStore.report.unavailable_fields.length"
      color="warning"
      class="text-start"
      title="Unavailable report fields"
      :description="comparisonStore.report.unavailable_fields.join(', ')"
    />
    <UAlert
      v-for="verdict in verdicts"
      :key="verdict.code"
      :color="verdict.color"
      class="text-start"
      :data-testid="`report-verdict-${verdict.code}`"
      :title="verdict.title"
      :description="verdict.note"
    />
    <UAlert
      v-if="versions"
      :color="versions.coversFullHistory ? 'info' : 'warning'"
      class="text-start"
      data-testid="report-version-history"
      :title="
        versions.coversFullHistory
          ? `Full live history since activation · ${versions.versions.length} versions, each change marked`
          : `Current version only · ${versions.versions.length} versions deployed`
      "
    >
      <template #description>
        <ol class="list-decimal ms-5">
          <li v-for="version in versions.versions" :key="version.id">
            {{ version.label }}
            <template v-if="!version.available"> (report not published)</template>
          </li>
        </ol>
      </template>
      <template v-if="fullHistoryLink" #actions>
        <RouterLink :to="fullHistoryLink" class="text-primary underline">
          Full history report and changelog
        </RouterLink>
      </template>
    </UAlert>
    <UAlert
      v-if="caveats.length"
      color="info"
      class="text-start"
      title="Report caveats"
      :description="annotationText"
    />
    <UAlert
      v-if="comparisonStore.report?.stale"
      color="warning"
      class="text-start"
      title="This report is marked stale"
    />

    <div class="flex flex-wrap gap-2 border-b border-surface-300 pb-2">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="{ path: item.to, query: route.query }"
        class="px-3 py-2 rounded-md transition-colors"
        :class="
          route.path === item.to
            ? 'bg-primary text-primary-contrast'
            : 'bg-surface-100 dark:bg-surface-800'
        "
      >
        {{ item.label }}
      </RouterLink>
      <RouterLink
        to="/reports"
        class="px-3 py-2 rounded-md bg-surface-100 dark:bg-surface-800 ms-auto"
      >
        All bots' reports →
      </RouterLink>
    </div>
    <RouterView />
  </div>
</template>
