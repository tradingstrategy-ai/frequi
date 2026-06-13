<script setup lang="ts">
import { useComparison } from '@/composables/useComparison';

const { comparisonStore, activeBotId, activeTimerange } = useComparison();

async function loadTimeline() {
  if (!activeBotId.value || !comparisonStore.isActiveBotSupported) return;
  comparisonStore.setTimerange(activeTimerange.value);
  await comparisonStore.loadTimeline(activeBotId.value, activeTimerange.value);
}

onMounted(async () => {
  await comparisonStore.ensureComparisonBots();
  await loadTimeline();
});

watch(
  () => [activeBotId.value, activeTimerange.value, comparisonStore.isActiveBotSupported],
  async () => loadTimeline(),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="comparisonStore.loading.timeline" class="flex flex-col gap-2 self-center">
      <UIcon name="mdi:loading" class="w-8 h-8 animate-spin" />
    </div>
    <UAlert
      v-else-if="comparisonStore.errors.timeline"
      color="warning"
      class="text-start"
      :title="comparisonStore.errors.timeline"
    />
    <template v-else-if="comparisonStore.timelineData">
      <EmptyComparisonState
        v-if="
          comparisonStore.timelineData.matched_trades.length === 0 &&
          comparisonStore.timelineData.gantt.length === 0
        "
        title="Timeline endpoint has no rows yet"
        detail="The UI is wired, but the comparison backend is still returning placeholder timeline payloads for this page."
      />
      <JsonPreviewCard
        title="Match Summary"
        :payload="comparisonStore.timelineData.match_summary"
        empty-text="No match summary values were returned."
      />
      <JsonPreviewCard
        title="Matched Trades"
        :payload="comparisonStore.timelineData.matched_trades"
        empty-text="No matched trade rows were returned."
      />
      <JsonPreviewCard
        title="Delays"
        :payload="comparisonStore.timelineData.delays"
        empty-text="No delay distribution is available yet."
      />
      <JsonPreviewCard
        title="Unmatched Trades"
        :payload="comparisonStore.timelineData.unmatched"
        empty-text="No unmatched trade payload was returned."
      />
    </template>
  </div>
</template>
