<script setup lang="ts">
const botStore = useBotStore();
const scrollContainer = ref<HTMLElement | null>(null);
const loadError = ref(false);

onMounted(() => {
  void refreshLogs();
});

async function refreshLogs() {
  loadError.value = false;
  try {
    await botStore.activeBot.getLogs();
    scrollToBottom();
  } catch {
    loadError.value = true;
  }
}

function getLogColor(logLevel: string) {
  switch (logLevel) {
    case 'WARNING':
      return 'text-yellow-500';
    case 'ERROR':
      return 'text-red-500';
    default:
      return 'text-neutral-500';
  }
}

function scrollToBottom() {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
}
</script>

<template>
  <div class="flex h-full p-0 align-items-start">
    <UAlert
      v-if="loadError"
      color="warning"
      title="Bot logs unavailable"
      description="The bot API did not return logs. Check the bot connection and retry."
      class="w-full"
    />
    <div
      v-else
      ref="scrollContainer"
      class="border border-neutral-500 p-1 text-start text-sm pb-5 w-full h-full overflow-auto"
    >
      <pre
        v-for="(log, index) in botStore.activeBot.lastLogs"
        :key="index"
        class="m-0 overflow-visible"
        style="line-height: unset"
      ><span class="text-neutral-600 dark:text-neutral-400">{{ log[0] }} <span :class="getLogColor(log[3])">{{ log[3].padEnd(7, ' ') }}</span> {{ log[2] }} - </span
      ><span class="dark:text-neutral-200">{{ log[4] }}</span
        ></pre>
    </div>
    <div class="flex flex-col gap-1 ms-1">
      <UButton
        id="refresh-logs"
        color="neutral"
        size="sm"
        title="Reload Logs"
        @click="refreshLogs"
        icon="mdi:refresh"
      />
      <UButton
        size="sm"
        title="Scroll to bottom"
        color="neutral"
        @click="scrollToBottom"
        icon="mdi:arrow-down-thick"
      />
    </div>
  </div>
</template>

<style lang="css" scoped>
textarea {
  width: 100%;
  min-height: 6em;
  resize: none;
}
</style>
