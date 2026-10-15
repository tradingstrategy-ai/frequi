<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useDashboardRegistry } from '@/composables/dashboardRegistry';
import type { RegistryBot } from '@/composables/dashboardRegistry';

/**
 * Live-vs-backtest HTML reports for every bot, Freqtrade and Nautilus.
 *
 * Each fleet host publishes its reporter's HTML bundle to vitalik8; the dashboard
 * gateway lists a bot's current bundle and serves only files named in its manifest
 * (see `FleetReportFrame`). Every bot also has its numbers in the Compare pages, which
 * this page links to.
 */
const route = useRoute();
const router = useRouter();
const botStore = useBotStore();
const { registry, registryLoaded, fetchDashboardRegistry, registryBotId } = useDashboardRegistry();

const filter = ref('');

const reportBots = computed<RegistryBot[]>(() =>
  (registry.value?.bots ?? []).filter((bot) => bot.has_reports),
);
const visibleBots = computed(() => {
  const text = filter.value.trim().toLowerCase();
  return reportBots.value.filter(
    (bot) => !text || bot.display_name.toLowerCase().includes(text) || bot.slug.includes(text),
  );
});
const groups = computed(() =>
  (['FT', 'NT'] as const)
    .map((engine) => ({
      engine,
      label: engine === 'FT' ? 'Freqtrade' : 'Nautilus',
      bots: visibleBots.value.filter((bot) => bot.engine === engine),
    }))
    .filter((group) => group.bots.length > 0),
);

const selectedSlug = computed(() => (typeof route.query.bot === 'string' ? route.query.bot : ''));
const selectedBot = computed(() => reportBots.value.find((bot) => bot.slug === selectedSlug.value));

function reportDate(value: string | null): string {
  return value && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : (value ?? '');
}

function selectBot(slug: string) {
  router.replace({ path: route.path, query: { bot: slug } });
}

onMounted(async () => {
  await fetchDashboardRegistry();
  if (!selectedBot.value) {
    // Prefer the bot selected elsewhere in FreqUI, else the first bot with reports.
    const active = reportBots.value.find((bot) => registryBotId(bot) === botStore.selectedBot);
    const slug = (active ?? reportBots.value[0])?.slug;
    if (slug) selectBot(slug);
  }
});
</script>

<template>
  <div class="flex flex-col gap-3 p-3 h-full">
    <div class="flex flex-col gap-1 text-start">
      <h2 class="text-2xl font-semibold">Live vs Backtest Reports</h2>
      <p class="text-surface-500 text-sm">
        The daily live-vs-backtest report each bot's host publishes, for every Freqtrade and
        Nautilus bot.
      </p>
    </div>

    <UAlert
      v-if="registryLoaded && !registry"
      color="info"
      class="text-start"
      title="Fleet reports need the dashboard gateway"
      description="This dashboard is served without the bot gateway, so only the central comparison pages are available."
    >
      <template #actions>
        <RouterLink to="/compare/overview" class="text-primary underline"
          >Open comparisons</RouterLink
        >
      </template>
    </UAlert>

    <div v-else class="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-3 grow min-h-0">
      <aside class="flex flex-col gap-2 text-start min-h-0" data-testid="report-bot-list">
        <UInput v-model="filter" icon="mdi:magnify" placeholder="Filter bots" size="sm" />
        <div class="overflow-auto flex flex-col gap-3">
          <div v-for="group in groups" :key="group.engine" class="flex flex-col gap-1">
            <div class="text-xs uppercase tracking-wide text-surface-500">
              {{ group.label }} · {{ group.bots.length }}
            </div>
            <button
              v-for="bot in group.bots"
              :key="bot.slug"
              type="button"
              class="flex flex-col items-start rounded-md px-2 py-1 text-sm transition-colors"
              :class="
                bot.slug === selectedSlug
                  ? 'bg-primary text-primary-contrast'
                  : 'hover:bg-surface-100 dark:hover:bg-surface-800'
              "
              :data-testid="`report-bot-${bot.slug}`"
              @click="selectBot(bot.slug)"
            >
              <span class="font-medium">{{ bot.display_name }}</span>
              <span class="text-xs opacity-75">{{ reportDate(bot.report_date) || 'no date' }}</span>
            </button>
          </div>
        </div>
      </aside>

      <section class="flex flex-col gap-2 min-h-0">
        <div v-if="selectedBot" class="flex flex-wrap items-center gap-2 text-start">
          <UBadge :color="selectedBot.engine === 'FT' ? 'info' : 'primary'">
            {{ selectedBot.engine }}
          </UBadge>
          <span class="font-semibold">{{ selectedBot.display_name }}</span>
          <span class="grow" />
          <RouterLink
            :to="{ path: '/compare/overview', query: { bot: registryBotId(selectedBot) } }"
            class="text-sm text-primary underline"
          >
            Compare numbers
          </RouterLink>
        </div>
        <FleetReportFrame v-if="selectedBot" :slug="selectedBot.slug" />
        <div
          v-else-if="registryLoaded && reportBots.length === 0"
          class="text-surface-500 text-start"
        >
          No bot has published a report bundle yet.
        </div>
      </section>
    </div>
  </div>
</template>
