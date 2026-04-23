<script setup lang="ts">
import type { AuthStorageWithBotId } from '@/types';
import type { PresetBotDefinition } from '@/config/presetBots';

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
