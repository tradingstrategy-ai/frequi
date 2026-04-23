import { useComparisonStore } from '@/stores/comparisonStore';

export function useComparison() {
  const botStore = useBotStore();
  const comparisonStore = useComparisonStore();
  const route = useRoute();

  const activeBotId = computed(() => botStore.selectedBot);
  const activeTimerange = computed(() => {
    if (typeof route.query.timerange === 'string') {
      return route.query.timerange;
    }
    return comparisonStore.timerange;
  });

  const activeBotName = computed(() => {
    return (
      comparisonStore.activeComparisonBot?.display_name ??
      botStore.selectedBotObj?.botName ??
      botStore.activeBotorUndefined?.botName ??
      activeBotId.value
    );
  });

  return {
    botStore,
    comparisonStore,
    activeBotId,
    activeBotName,
    activeTimerange,
  };
}
