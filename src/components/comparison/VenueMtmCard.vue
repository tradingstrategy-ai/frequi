<script setup lang="ts">
import type { DashboardReportMetadata } from '@/types';
import { venueMtmView } from '@/utils/reportVersions';

/**
 * The account's venue mark-to-market headline, as the daily report prints it.
 *
 * The KPI cards and equity curve below are closed-trade figures and exclude open
 * positions; this is the venue's own account equity since activation (Hyperliquid
 * Nautilus bots). Values are shown exactly as published, never recomputed.
 */
const props = defineProps<{ report: DashboardReportMetadata | null | undefined }>();
const view = computed(() => venueMtmView(props.report));
</script>

<template>
  <UCard v-if="view?.kind === 'ok'" data-testid="venue-mtm-card">
    <div class="text-lg font-semibold mb-1 text-start">Venue mark-to-market equity</div>
    <p class="mb-3 text-sm text-surface-500 text-start">
      Account-level equity from the venue since activation, open positions included. The figures
      below it are closed trades only.
    </p>
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <div v-for="card in view.cards" :key="card.label" class="flex flex-col text-start">
        <span class="text-xs uppercase tracking-wide text-surface-500">{{ card.label }}</span>
        <span class="font-semibold">{{ card.value }}</span>
      </div>
    </div>
  </UCard>
  <UAlert
    v-else-if="view?.kind === 'unavailable'"
    color="warning"
    class="text-start"
    data-testid="venue-mtm-unavailable"
    title="Venue mark-to-market equity unavailable"
    :description="`${view.reason}. The figures below are closed trades only and exclude open positions.`"
  />
</template>
