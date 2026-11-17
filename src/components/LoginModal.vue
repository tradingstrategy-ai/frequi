<script setup lang="ts">
import type { AuthStorageWithBotId } from '@/types';
import type { PresetBotDefinition } from '@/config/presetBots';

export interface LoginModalProps {
  loginInfo?: AuthStorageWithBotId;
  presetBot?: PresetBotDefinition;
}

defineProps<LoginModalProps>();
const emit = defineEmits<{
  close: [value: boolean];
}>();

function loginResult(result: boolean) {
  if (result) {
    // Only close if
    emit('close', result);
  }
}
</script>

<template>
  <UModal title="Login to your bot" description="Enter your bot credentials to connect">
    <template #body>
      <BotLogin
        in-modal
        :existing-auth="loginInfo"
        :preset-bot="presetBot"
        @login-result="loginResult"
      />
    </template>
  </UModal>
</template>
