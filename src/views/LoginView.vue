<script setup lang="ts">
import type { AuthStorageWithBotId } from '@/types';
import type { PresetBotDefinition } from '@/config/presetBots';
import { REPORTS_AUTH_BOOTSTRAP_URL } from '@/utils/botAuthorization';

const existingAuth = ref<AuthStorageWithBotId | undefined>(undefined);
const presetBot = ref<PresetBotDefinition | undefined>(undefined);

function selectPreset(bot: PresetBotDefinition) {
  existingAuth.value = undefined;
  presetBot.value = bot;
}

function relogin(bot: AuthStorageWithBotId) {
  existingAuth.value = bot;
  presetBot.value = undefined;
}
</script>

<template>
  <div class="max-w-6xl mx-auto p-4 my-5">
    <UAlert
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
      <DraggableContainer header="Supported comparison bots">
        <PresetBotList @connect="selectPreset" @relogin="relogin" />
      </DraggableContainer>
      <DraggableContainer header="Freqtrade bot Login" class="px-4 py-2">
        <BotLogin ref="loginForm" :existing-auth="existingAuth" :preset-bot="presetBot" />
      </DraggableContainer>
    </div>
  </div>
</template>
