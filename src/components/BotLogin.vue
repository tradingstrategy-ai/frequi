<script setup lang="ts">
import type { AuthPayload, AuthStorageWithBotId } from '@/types';
import type { PresetBotDefinition } from '@/config/presetBots';

import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import {
  isProxiedBotUrl,
  isReportsAuthChallenge,
  REPORTS_AUTH_BOOTSTRAP_URL,
  REPORTS_AUTH_CHECK_URL,
} from '@/utils/botAuthorization';
import { findProxiedBotRoute } from '@/utils/knownBotUrls';

const props = withDefaults(
  defineProps<{
    inModal?: boolean;
    existingAuth?: AuthStorageWithBotId;
    presetBot?: PresetBotDefinition;
  }>(),
  {
    inModal: false,
    existingAuth: undefined,
    presetBot: undefined,
  },
);
const emit = defineEmits<{ loginResult: [value: boolean] }>();

const defaultURL = window.location.origin || 'http://localhost:3000';

const router = useRouter();
const route = useRoute();
const botStore = useBotStore();

const nameState = ref<boolean>();
const pwdState = ref<boolean>();
const urlState = ref<boolean>();
const errorMessage = ref<string>('');
const errorMessageCORS = ref<boolean>(false);
const reportsAuthRequired = ref<boolean>(false);
const formRef = ref<HTMLFormElement>();
const botEdit = ref<boolean>(false);
const auth = ref<AuthPayload>({
  botName: '',
  url: defaultURL,
  username: '',
  password: '',
});

function emitLoginResult(value: boolean) {
  emit('loginResult', value);
}

const presetMode = computed(() => !botEdit.value && props.presetBot !== undefined);

const urlDuplicate = computed<boolean>(() => {
  const bots = Object.values(botStore.availableBots).find((bot) => bot.botUrl === auth.value.url);
  return !botEdit.value && bots !== undefined;
});

// A direct address of a known production bot is cross-origin here and would fail
// on the bot's CORS policy, so it is connected through the same-origin proxy.
const proxiedRoute = computed<string | undefined>(() => findProxiedBotRoute(auth.value.url));

function canRequireCorsConfiguration(apiUrl: string): boolean {
  try {
    return new URL(apiUrl, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function getPingUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, '')}/api/v1/ping`;
}

function checkFormValidity() {
  const valid = formRef.value?.checkValidity();
  nameState.value = valid || auth.value.username !== '';
  pwdState.value = valid || auth.value.password !== '';
  urlState.value = valid || auth.value.url !== '';
  return valid;
}

function resetLogin() {
  auth.value.botName = '';
  auth.value.url = defaultURL;
  auth.value.username = '';
  auth.value.password = '';
  nameState.value = undefined;
  pwdState.value = undefined;
  urlState.value = undefined;
  errorMessage.value = '';
  errorMessageCORS.value = false;
  reportsAuthRequired.value = false;
  botEdit.value = false;
}

function handleReset(evt) {
  evt.preventDefault();
  resetLogin();
}

async function handleSubmit() {
  // Exit when the form isn't valid
  if (!checkFormValidity()) {
    return;
  }
  auth.value.url = proxiedRoute.value ?? auth.value.url.trim().replace(/\/+$/, '');
  errorMessage.value = '';
  errorMessageCORS.value = false;
  reportsAuthRequired.value = false;
  // Push the name to submitted names
  try {
    if (isProxiedBotUrl(auth.value.url)) {
      // Proving reports BasicAuth first means a later 401 can only have come
      // from the bot. Direct bot URLs never touch this route.
      await axios.get(REPORTS_AUTH_CHECK_URL, { withCredentials: true });
    }
    const botId = props.existingAuth?.botId ?? props.presetBot?.botId ?? botStore.nextBotId;
    const { login } = useLoginInfo(botId);
    await login(auth.value);
    if (botEdit.value) {
      botStore.updateBot(botId, {
        botName: auth.value.botName,
        botUrl: auth.value.url,
      });
      const thisBot = botStore.botStores[botId];
      if (thisBot) {
        thisBot.isBotLoggedIn = true;
        thisBot.isBotOnline = true;
      }
      emitLoginResult(true);
    } else {
      const sortId = props.presetBot?.sortId ?? Object.keys(botStore.availableBots).length + 1;
      const botDescriptor = {
        botName: auth.value.botName,
        botId,
        botUrl: auth.value.url,
        sortId,
      };
      if (botId in botStore.availableBots) {
        botStore.updateBot(botId, botDescriptor);
      } else {
        botStore.addBot(botDescriptor);
      }
      botStore.selectBot(botId);
      emitLoginResult(true);
      botStore.allRefreshFull();
    }

    if (props.inModal === false) {
      if (typeof route?.query.redirect === 'string') {
        const resolved = router.resolve({ path: route.query.redirect });
        if (resolved.name === '404') {
          router.push('/');
        } else {
          router.push(resolved.path);
        }
      } else {
        router.push('/');
      }
    }
  } catch (error) {
    errorMessageCORS.value = false;
    // this.nameState = false;
    console.error(error);
    const fromPreflight = axios.isAxiosError(error) && error.config?.url === REPORTS_AUTH_CHECK_URL;
    if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
      // The preflight's 401, or Caddy's challenge on the login call itself when
      // reports auth lapsed in between, both mean the bot was never contacted.
      if (fromPreflight || isReportsAuthChallenge(error.response.headers)) {
        reportsAuthRequired.value = true;
        errorMessage.value = 'Reports authentication is required before connecting to a bot.';
      } else {
        nameState.value = false;
        pwdState.value = false;
        errorMessage.value = 'Connected to bot, however Login failed, Username or Password wrong.';
      }
    } else if (fromPreflight) {
      urlState.value = true;
      errorMessage.value =
        'Could not verify reports authentication with the proxy, so the bot was not contacted. Please check that the reports site is reachable.';
    } else {
      urlState.value = true;
      errorMessage.value = `Could not reach the bot API or its proxy. Please verify that the bot is running, the Bot API is enabled and ${getPingUrl(auth.value.url)} is reachable.`;
      if (canRequireCorsConfiguration(auth.value.url)) {
        errorMessageCORS.value = true;
      }
    }
    console.error(errorMessage.value);
    emitLoginResult(false);
  }
}

function handleOk(evt) {
  evt.preventDefault();
  handleSubmit();
}

function reset() {
  resetLogin();
  if (props.existingAuth) {
    botEdit.value = true;
    auth.value.botName = props.existingAuth.botName;
    auth.value.url = props.existingAuth.apiUrl;
    auth.value.username = props.existingAuth.username ?? '';
  } else if (props.presetBot) {
    auth.value.botName = props.presetBot.botName;
    auth.value.url = props.presetBot.botUrl;
  }
}

defineExpose({
  reset,
});

onMounted(() => {
  reset();
});

watch(
  () => [props.existingAuth, props.presetBot],
  () => reset(),
  { deep: true },
);
</script>

<template>
  <form ref="formRef" novalidate @submit.stop.prevent="handleSubmit" @reset="handleReset">
    <UAlert v-if="presetMode" class="mb-4 text-start" color="info" title="Preset bot">
      <template #description>
        Connecting preset bot <strong>{{ props.presetBot?.botName }}</strong
        >. The stable UI bot id will remain <code>{{ props.presetBot?.botId }}</code
        >.
      </template>
    </UAlert>
    <UFormField class="mb-4" label="Bot Name">
      <UInput
        id="name-input"
        v-model="auth.botName"
        placeholder="Bot Name"
        class="mt-1 block w-full"
        @keydown.enter="handleOk"
      />
    </UFormField>
    <UFormField
      class="mb-4"
      label="API Url"
      :error="urlState === false ? 'API URL is required.' : undefined"
    >
      <UInput
        id="url-input"
        v-model="auth.url"
        required
        trim
        class="mt-1 block w-full"
        @keydown.enter="handleOk"
      />
      <UAlert
        v-if="proxiedRoute"
        class="mt-2"
        color="info"
        title="Connecting through the dashboard proxy"
      >
        <template #description>
          This bot is reached through <code>{{ proxiedRoute }}</code> on this site, so its CORS
          settings do not apply. Submit will use that address.
        </template>
      </UAlert>
      <UAlert
        v-if="urlDuplicate"
        class="mt-2"
        color="warning"
        title="This URL is already in use by another bot."
      >
      </UAlert>
    </UFormField>
    <UFormField
      class="mb-4"
      label="Username"
      :error="nameState === false ? 'Name and Password are required.' : undefined"
    >
      <UInput
        v-model="auth.username"
        required
        placeholder="Freqtrader"
        class="w-full"
        @keydown.enter="handleOk"
      />
    </UFormField>
    <UFormField
      class="mb-4"
      label="Password"
      :error="pwdState === false ? 'Invalid Password' : undefined"
    >
      <UInput
        v-model="auth.password"
        required
        type="password"
        class="w-full"
        @keydown.enter="handleOk"
      />
    </UFormField>
    <div>
      <UAlert
        v-if="errorMessage"
        class="mt-2 whitespace-pre-line"
        color="warning"
        title="Login failed"
      >
        <template #description>
          {{ errorMessage }}
          <a
            v-if="reportsAuthRequired"
            :href="REPORTS_AUTH_BOOTSTRAP_URL"
            class="text-primary underline"
          >
            Connect to reports
          </a>
          <span v-if="errorMessageCORS">
            Please also check your bot's CORS configuration:
            <a
              href="https://www.freqtrade.io/en/latest/rest-api/#cors"
              class="text-blue-500 underline"
              >Freqtrade CORS documentation</a
            >
          </span>
        </template>
      </UAlert>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <UButton label="Reset" color="error" type="reset" />
      <UButton
        v-if="inModal"
        label="Cancel"
        color="neutral"
        type="button"
        @click="emitLoginResult(true)"
      />
      <UButton label="Submit" color="primary" type="submit" icon="mdi:login" />
    </div>
  </form>
</template>
