<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const route = useRoute();
const router = useRouter();
const { comparisonStore, activeBotId, activeBotName, activeTimerange, activeSleeve } = useComparison();
const timerangeInput = ref('');
const now = ref(Date.now());
let ageTimer: number | undefined;

const navItems = [
  { label: 'Overview', to: '/compare/overview' },
  { label: 'Timeline', to: '/compare/timeline' },
  { label: 'Pairs', to: '/compare/pairs' },
  { label: 'Deep Dive', to: '/compare/trades' },
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
const annotationText = computed(() =>
  (comparisonStore.report?.annotations ?? []).map(({ code, note }) => `${code}: ${note}`).join(' · '),
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
  });
}

function selectSleeve(sleeve: string) {
  comparisonStore.setSelectedSleeve(sleeve);
  updateQuery({ sleeve: sleeve || undefined });
}

onMounted(async () => {
  timerangeInput.value = activeTimerange.value;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.ensureComparisonBots();
  const requestedBot = typeof route.query.bot === 'string' ? route.query.bot : '';
  if (requestedBot && comparisonStore.isSupportedBot(requestedBot)) {
    comparisonStore.setSelectedBot(requestedBot);
  } else if (requestedBot) {
    updateQuery({ bot: undefined, sleeve: undefined });
  }
  const invalidRequestedBot = Boolean(requestedBot && !comparisonStore.isSupportedBot(requestedBot));
  const requestedSleeve = !invalidRequestedBot && typeof route.query.sleeve === 'string'
    ? route.query.sleeve
    : invalidRequestedBot ? '' : comparisonStore.selectedSleeve;
  comparisonStore.setSelectedSleeve(requestedSleeve);
  if (requestedSleeve && comparisonStore.selectedSleeve !== requestedSleeve) {
    updateQuery({ sleeve: undefined });
  }
  ageTimer = window.setInterval(() => { now.value = Date.now(); }, 30_000);
});

onBeforeUnmount(() => {
  if (ageTimer !== undefined) window.clearInterval(ageTimer);
});

watch(() => activeTimerange.value, (value) => {
  timerangeInput.value = value;
  comparisonStore.setTimerange(value);
});

watch(() => route.query.sleeve, (value) => {
  if (!comparisonStore.supportedBotsLoaded) return;
  const requestedSleeve = typeof value === 'string' ? value : '';
  comparisonStore.setSelectedSleeve(requestedSleeve);
  if (requestedSleeve && comparisonStore.selectedSleeve !== requestedSleeve) {
    updateQuery({ sleeve: undefined });
  }
});

watch(() => route.query.bot, (value) => {
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
});
</script>

<template>
  <div class="flex flex-col gap-4 p-3">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div class="text-start">
        <h2 class="text-2xl font-semibold">Report Comparison</h2>
        <p class="text-surface-500">
          Selected report: <span class="font-medium">{{ activeBotName || 'Loading reports…' }}</span>
          <template v-if="comparisonStore.activeComparisonBot?.venue"> · {{ comparisonStore.activeComparisonBot.venue }}</template>
        </p>
        <p v-if="comparisonStore.report" class="text-sm text-surface-500">
          {{ comparisonStore.report.status }} · generated {{ reportAge }}
          <template v-if="generatedAtUtc"> · as of {{ generatedAtUtc }} UTC</template>
          <template v-if="comparisonStore.report.report_date"> · report date {{ comparisonStore.report.report_date }}</template>
          <template v-if="reportWindowText"> · window {{ reportWindowText }}</template>
          <template v-if="comparisonStore.report.reason"> · {{ comparisonStore.report.reason }}</template>
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
          v-if="comparisonStore.activeComparisonBot?.sleeves.length"
          :model-value="activeSleeve"
          :items="['All sleeves', ...comparisonStore.activeComparisonBot.sleeves]"
          class="min-w-40"
          @update:model-value="selectSleeve($event === 'All sleeves' ? '' : $event)"
        />
        <UInput v-model="timerangeInput" class="min-w-[220px]" placeholder="YYYYMMDD-YYYYMMDD" />
        <UButton color="neutral" icon="mdi:calendar-range" @click="applyTimerange">Apply timerange</UButton>
      </div>
    </div>

    <UAlert v-if="comparisonStore.authRequired" color="warning" class="text-start"
      title="Reconnect to reports" description="Report access requires authentication. Continue to the report service to sign in.">
      <template #actions>
        <a href="/api/comparison/auth-check" class="text-primary underline">Connect to reports</a>
      </template>
    </UAlert>
    <UAlert v-else-if="comparisonStore.supportedBotsError" color="warning" class="text-start"
      :title="comparisonStore.supportedBotsError">
      <template #actions>
        <a href="/api/comparison/auth-check" class="text-primary underline">Connect to reports</a>
      </template>
    </UAlert>
    <UAlert v-if="comparisonStore.supportedBotsLoaded && comparisonStore.supportedBots.length === 0"
      color="info" class="text-start" title="No reports are available yet"
      description="The report service returned an empty comparison catalog." />
    <UAlert v-if="comparisonStore.report && comparisonStore.report.unavailable_fields.length"
      color="warning" class="text-start" title="Unavailable report fields"
      :description="comparisonStore.report.unavailable_fields.join(', ')" />
    <UAlert v-if="comparisonStore.report?.annotations.length" color="info" class="text-start"
      title="Report caveats" :description="annotationText" />
    <UAlert v-if="comparisonStore.report?.stale" color="warning" class="text-start"
      title="This report is marked stale" />

    <div class="flex flex-wrap gap-2 border-b border-surface-300 pb-2">
      <RouterLink v-for="item in navItems" :key="item.to" :to="{ path: item.to, query: route.query }"
        class="px-3 py-2 rounded-md transition-colors"
        :class="route.path === item.to ? 'bg-primary text-primary-contrast' : 'bg-surface-100 dark:bg-surface-800'">
        {{ item.label }}
      </RouterLink>
    </div>
    <RouterView />
  </div>
</template>
