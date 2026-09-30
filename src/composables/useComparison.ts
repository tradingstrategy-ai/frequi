import { useComparisonStore } from '@/stores/comparisonStore';

export function useComparison() {
  const comparisonStore = useComparisonStore();
  const route = useRoute();

  const activeBotId = computed(() => comparisonStore.selectedBotId);
  const activeSleeve = computed(() => {
    if (typeof route.query.sleeve === 'string') return route.query.sleeve;
    return comparisonStore.selectedSleeve;
  });
  const activeTimerange = computed(() => {
    if (typeof route.query.timerange === 'string') {
      return route.query.timerange;
    }
    return comparisonStore.timerange;
  });

  const activeBotName = computed(() => {
    return comparisonStore.activeComparisonBot?.display_name ?? activeBotId.value;
  });

  return {
    comparisonStore,
    activeBotId,
    activeBotName,
    activeTimerange,
    activeSleeve,
  };
}
