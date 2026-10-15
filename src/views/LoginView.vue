<script setup lang="ts">
import { useDashboardRegistry } from '@/composables/dashboardRegistry';
import type { AuthStorageWithBotId } from '@/types';
import type { PresetBotDefinition } from '@/config/presetBots';
import { REPORTS_AUTH_BOOTSTRAP_URL } from '@/utils/botAuthorization';
import { useRoute, useRouter } from 'vue-router';

const existingAuth = ref<AuthStorageWithBotId | undefined>(undefined);
const presetBot = ref<PresetBotDefinition | undefined>(undefined);
const route = useRoute();
const router = useRouter();
const botStore = useBotStore();
const {
  registry,
  registryLoaded,
  connecting,
  fetchDashboardRegistry,
  connectRegistryBots,
  registryBotId,
} = useDashboardRegistry();

const gatewayBots = computed(() => registry.value?.bots ?? []);
const connectedCount = computed(
  () => gatewayBots.value.filter((bot) => registryBotId(bot) in botStore.availableBots).length,
);

function selectPreset(bot: PresetBotDefinition) {
  existingAuth.value = undefined;
  presetBot.value = bot;
}

function relogin(bot: AuthStorageWithBotId) {
  existingAuth.value = bot;
  presetBot.value = undefined;
}

function continueToTarget() {
  const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  const resolved = router.resolve({ path: target });
  router.push(resolved.name === '404' || resolved.path === '/login' ? '/' : resolved.path);
}

async function connectAll() {
  await connectRegistryBots();
  if (botStore.hasBots) {
    continueToTarget();
  }
}

onMounted(async () => {
  const loaded = await fetchDashboardRegistry();
  if (!loaded) {
    return;
  }
  // First visit behind the gateway: initBots() is already connecting; wait for it,
  // then carry on to the page that sent us here.
  await connectRegistryBots();
  if (botStore.hasBots && typeof route.query.redirect === 'string') {
    continueToTarget();
  }
});
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 my-5">
    <UAlert
      v-if="registryLoaded && registry"
      class="mb-4 text-start"
      color="success"
      icon="mdi:lan-connect"
      :title="`Dashboard gateway: ${connectedCount} of ${gatewayBots.length} bots connected`"
      description="Every Freqtrade and Nautilus bot in the dashboard registry connects automatically; the gateway holds their logins, so no bot password is needed here."
    >
      <template #actions>
        <UButton
          size="sm"
          icon="mdi:connection"
          :loading="connecting"
          :disabled="connecting || connectedCount === gatewayBots.length"
          data-testid="connect-all-bots"
          @click="connectAll"
        >
          {{ connectedCount === gatewayBots.length ? 'All bots connected' : 'Connect all bots' }}
        </UButton>
        <UButton
          v-if="botStore.hasBots"
          size="sm"
          color="neutral"
          variant="outline"
          @click="continueToTarget"
        >
          Open dashboard
        </UButton>
      </template>
    </UAlert>
    <UAlert
      v-else-if="registryLoaded"
      class="mb-4 text-start"
      color="info"
      title="Connect to reports before signing in"
      description="Report authentication protects the same-origin bot API routes."
    >
      <template #actions>
        <a :href="REPORTS_AUTH_BOOTSTRAP_URL" class="text-primary underline">Connect to reports</a>
      </template>
    </UAlert>
    <div class="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-4">
      <DraggableContainer :header="registry ? 'Dashboard bots' : 'Supported comparison bots'">
        <PresetBotList @connect="selectPreset" @relogin="relogin" />
      </DraggableContainer>
      <DraggableContainer header="Freqtrade bot Login" class="px-4 py-2">
        <BotLogin ref="loginForm" :existing-auth="existingAuth" :preset-bot="presetBot" />
      </DraggableContainer>
    </div>
  </div>
</template>
