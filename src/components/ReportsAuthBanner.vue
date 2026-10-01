<script setup lang="ts">
import { REPORTS_AUTH_BOOTSTRAP_URL } from '@/utils/botAuthorization';
import { reportsAuthRequired } from '@/composables/reportsAuth';
</script>

<template>
  <UAlert
    v-if="reportsAuthRequired"
    class="mx-4 mt-2 text-start"
    color="warning"
    icon="i-mdi-shield-lock-outline"
    title="Reports authentication expired"
    description="Bot requests are being rejected by the reports proxy. Your bot logins are still valid - reconnect to reports to resume updates."
  >
    <template #actions>
      <a :href="REPORTS_AUTH_BOOTSTRAP_URL" class="text-primary underline">Connect to reports</a>
    </template>
  </UAlert>
</template>
