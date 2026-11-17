<script setup lang="ts">
/**
 * A Compare tab made only of daily-report sections (Execution, Universe & Signals).
 *
 * The comparison API has no native endpoint for these views; the gateway reads them
 * from the bot's live-vs-backtest report.
 */
import ReportSections from '@/components/comparison/report/ReportSections.vue';
import type { ReportTab } from '@/composables/reportSections';

defineProps<{ tab: ReportTab; heading: string }>();
</script>

<template>
  <div class="flex flex-col gap-4">
    <ReportSections :tab="tab" :heading="heading" />
  </div>
</template>
