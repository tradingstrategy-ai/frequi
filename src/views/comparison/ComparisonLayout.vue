<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const route = useRoute();
const router = useRouter();
const { comparisonStore, activeBotId, activeBotName, activeTimerange } = useComparison();

const timerangeInput = ref('');

const navItems = [
  { label: 'Overview', to: '/compare/overview' },
  { label: 'Timeline', to: '/compare/timeline' },
  { label: 'Pairs', to: '/compare/pairs' },
  { label: 'Deep Dive', to: '/compare/trades' },
];

function applyTimerange() {
  const nextTimerange = timerangeInput.value.trim();
  comparisonStore.setTimerange(nextTimerange);
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      timerange: nextTimerange || undefined,
    },
  });
}

async function refreshBacktest() {
  await comparisonStore.triggerBacktestRefresh(activeBotId.value);
}

onMounted(async () => {
  timerangeInput.value = activeTimerange.value;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.ensureComparisonBots();
});

watch(
  () => activeTimerange.value,
  (value) => {
    timerangeInput.value = value;
    comparisonStore.setTimerange(value);
  },
);
</script>

<template>
  <div class="flex flex-col gap-4 p-3">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div class="text-start">
        <h2 class="text-2xl font-semibold">Live vs Backtest Comparison</h2>
        <p class="text-surface-500">
          Active bot:
          <span class="font-medium">{{ activeBotName || activeBotId || 'No bot selected' }}</span>
        </p>
      </div>
      <div class="flex flex-col md:flex-row gap-2 md:items-center">
        <InputText v-model="timerangeInput" class="min-w-[220px]" placeholder="YYYYMMDD-YYYYMMDD" />
        <Button severity="secondary" @click="applyTimerange">
          <template #icon><i-mdi-calendar-range /></template>
          Apply timerange
        </Button>
        <Button
          v-if="comparisonStore.canRefreshBacktest"
          severity="contrast"
          @click="refreshBacktest"
        >
          <template #icon><i-mdi-refresh /></template>
          Refresh Backtest
        </Button>
      </div>
    </div>

    <Message v-if="comparisonStore.supportedBotsError" severity="warn" class="text-start">
      {{ comparisonStore.supportedBotsError }}
    </Message>

    <Message
      v-if="
        activeBotId &&
        !comparisonStore.isActiveBotSupported &&
        !comparisonStore.supportedBotsLoading
      "
      severity="warn"
      class="text-start"
    >
      Comparison unavailable for this bot. Use one of the supported preset FT/NT bot entries.
    </Message>

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
    </div>

    <RouterView />
  </div>
</template>
