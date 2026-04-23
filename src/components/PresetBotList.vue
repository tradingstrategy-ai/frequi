<script setup lang="ts">
import type { AuthStorageWithBotId } from '@/types';
import { getPresetBots } from '@/config/presetBots';
import type { PresetBotDefinition } from '@/config/presetBots';

withDefaults(
  defineProps<{
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const emit = defineEmits<{
  connect: [presetBot: PresetBotDefinition];
  relogin: [loginInfo: AuthStorageWithBotId];
}>();

const botStore = useBotStore();
const presetBots = computed(() => getPresetBots());

function openPreset(presetBot: PresetBotDefinition) {
  const bot = botStore.botStores[presetBot.botId];
  if (bot) {
    emit('relogin', {
      ...bot.getLoginInfo(),
      botId: presetBot.botId,
    });
    return;
  }
  emit('connect', presetBot);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="text-start">
      <h3 class="font-semibold" :class="{ 'text-sm': compact, 'text-lg': !compact }">
        Preset Bots
      </h3>
      <p class="text-sm text-surface-500">
        Connect the supported FT and NT bots with stable ids for the comparison pages.
      </p>
    </div>
    <div
      class="grid gap-3"
      :class="{ 'grid-cols-1': compact, 'grid-cols-1 lg:grid-cols-2': !compact }"
    >
      <div
        v-for="presetBot in presetBots"
        :key="presetBot.botId"
        class="border rounded-md p-3 text-start flex flex-col gap-2"
      >
        <div class="flex items-center gap-2">
          <Badge
            :value="presetBot.botType"
            :severity="presetBot.botType === 'FT' ? 'info' : 'contrast'"
          />
          <span class="font-semibold">{{ presetBot.botName }}</span>
          <Badge
            v-if="presetBot.botId in botStore.availableBots"
            value="Connected"
            severity="success"
          />
        </div>
        <div class="text-sm text-surface-500">{{ presetBot.description }}</div>
        <code class="text-xs break-all">{{ presetBot.botUrl }}</code>
        <div class="flex justify-end">
          <Button size="small" severity="secondary" @click="openPreset(presetBot)">
            <template #icon>
              <i-mdi-login />
            </template>
            {{ presetBot.botId in botStore.availableBots ? 'Reconnect' : 'Connect' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
