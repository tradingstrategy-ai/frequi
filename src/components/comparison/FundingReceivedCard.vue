<script setup lang="ts">
import { fetchFunding } from '@/composables/comparisonApi';
import { FUNDING_BOT_IDS, loadFundingView } from '@/utils/fundingView';
import type { FundingView } from '@/utils/fundingView';

const props = defineProps<{ botId: string }>();

const view = ref<FundingView | null>(null);
const loading = ref(false);
const loadError = ref('');
let generation = 0;

const applies = computed(() => FUNDING_BOT_IDS.includes(props.botId));
const badge = computed(() => {
  switch (view.value?.state) {
    case 'ok':
      return { label: 'Verified', color: 'success' as const };
    case 'stale':
      return { label: 'Stale', color: 'warning' as const };
    case 'invalid':
      return { label: 'Invalid', color: 'error' as const };
    default:
      return { label: 'No data', color: 'neutral' as const };
  }
});

async function load() {
  const request = ++generation;
  view.value = null;
  loadError.value = '';
  if (!applies.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const result = await loadFundingView(props.botId, fetchFunding);
  if (request !== generation) return;
  view.value = result.view;
  loadError.value = result.error;
  loading.value = false;
}

watch(() => props.botId, load, { immediate: true });
</script>

<template>
  <UCard v-if="applies && (loading || view || loadError)" data-testid="funding-card">
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="text-lg font-semibold">Funding received</div>
      <UBadge v-if="view" :color="badge.color" variant="subtle" data-testid="funding-state">
        {{ badge.label }}
      </UBadge>
    </div>

    <div v-if="loading" class="text-sm text-surface-500 text-start" data-testid="funding-loading">
      Loading funding…
    </div>
    <UAlert
      v-else-if="loadError"
      color="warning"
      class="text-start"
      :title="loadError"
      data-testid="funding-load-error"
    />
    <template v-else-if="view">
      <div v-if="view.headline" class="text-start">
        <div class="text-2xl font-semibold" data-testid="funding-total">{{ view.headline }}</div>
        <div class="text-sm text-surface-500" data-testid="funding-as-of">
          as of {{ view.asOf }}
        </div>
        <UAlert
          v-if="view.state === 'stale'"
          color="warning"
          class="mt-2 text-start"
          :title="`Older than expected${view.reason ? ` — ${view.reason}` : ''}`"
          description="Funding only grows, so an old figure understates what has been earned."
          data-testid="funding-stale"
        />
        <ul class="mt-2 text-sm" data-testid="funding-breakdown">
          <li v-for="item in view.breakdown" :key="item.label">
            <span class="text-surface-500">{{ item.label }}:</span> {{ item.value }}
          </li>
        </ul>
        <p v-if="view.note" class="mt-2 text-sm text-surface-500" data-testid="funding-note">
          {{ view.note }}
        </p>
      </div>
      <UAlert
        v-else
        :color="view.state === 'invalid' ? 'warning' : 'info'"
        class="text-start"
        :title="
          view.state === 'invalid' ? 'Funding data failed verification' : 'No funding data yet'
        "
        :description="view.reason ?? undefined"
        data-testid="funding-no-number"
      />
    </template>

    <p class="mt-3 text-xs text-surface-500 text-start">
      Funding GMX credits to a claimable balance rather than the wallet. It is shown separately and
      is not part of Total Profit. Updated about every few hours, not real time.
    </p>
  </UCard>
</template>
