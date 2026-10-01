import type { AxiosResponse } from 'axios';
import axios from 'axios';
import { getPresetBots } from '@/config/presetBots';
import {
  BOT_AUTHORIZATION_HEADER,
  encodeBasicAuthorization,
  getBotAuthorizationHeaderName,
  isProxiedBotUrl,
  isReportsAuthChallenge,
} from '@/utils/botAuthorization';
import { requireReportsAuth } from '@/composables/reportsAuth';

import type {
  AuthPayload,
  AuthResponse,
  BotDescriptors,
  AuthStorage,
  AuthStorageMulti,
  BotDescriptor,
} from '@/types';

const AUTH_LOGIN_INFO = 'ftAuthLoginInfo';
const AUTH_SELECTED_BOT = 'ftSelectedBot';
const APIBASE = '/api/v1';
const PRELOAD_DEMO_BOTS = import.meta.env.DEV && import.meta.env.VITE_PRELOAD_DEMO_BOTS !== 'false';

// Global state for all login infos
const allLoginInfos = useStorage<AuthStorageMulti>(AUTH_LOGIN_INFO, {});

export function seedDemoPresetBots(force = false): string[] {
  const enabled = force || PRELOAD_DEMO_BOTS;
  if (!enabled) {
    return [];
  }

  const seeded: string[] = [];
  const nextLoginInfos = { ...allLoginInfos.value };
  for (const bot of getPresetBots()) {
    if (nextLoginInfos[bot.botId]) {
      continue;
    }
    nextLoginInfos[bot.botId] = {
      botName: bot.botName,
      apiUrl: bot.botUrl,
      username: 'freqtrade',
      refreshToken: `${bot.botId}-refresh-token`,
      accessToken: `${bot.botId}-access-token`,
      autoRefresh: false,
      sortId: bot.sortId,
    };
    seeded.push(bot.botId);
  }

  if (seeded.length > 0) {
    allLoginInfos.value = nextLoginInfos;
  }

  // Only override the user's selection if it's missing or no longer present
  // in the bot list (preset or custom). Previously this clause also nuked
  // any NT selection on every page load, which was a leftover from when NT
  // bots were placeholder-only — it broke real-NT-vault navigation
  // (selecting an NT bot then clicking a different tab reset to ichiv3 HL).
  const currentSelected = localStorage.getItem(AUTH_SELECTED_BOT);
  const currentReachable = currentSelected ? Boolean(nextLoginInfos[currentSelected]) : false;
  if (!currentSelected || !currentReachable) {
    const preferred = nextLoginInfos['ichiv3-ls-hyperliquid-live']
      ? 'ichiv3-ls-hyperliquid-live'
      : nextLoginInfos['ichiv2-ls-hyperliquid-live']
        ? 'ichiv2-ls-hyperliquid-live'
        : nextLoginInfos['nt-opencz-vault']
          ? 'nt-opencz-vault'
          : seeded[0];
    if (preferred) {
      localStorage.setItem(AUTH_SELECTED_BOT, preferred);
    }
  }

  return seeded;
}

/**
 * Get available bots with their descriptors
 */
export const loggedInBots = computed<BotDescriptors>(() => {
  const allInfo = allLoginInfos.value;
  const response: BotDescriptors = {};
  Object.keys(allInfo)
    .sort((a, b) => (allInfo[a]?.sortId ?? 0) - (allInfo[b]?.sortId ?? 0))
    .forEach((k, idx) => {
      const bot = allInfo[k];
      if (!bot) return;
      response[k] = {
        botId: k,
        botName: bot.botName,
        botUrl: bot.apiUrl,
        sortId: bot.sortId ?? idx,
      };
    });

  return response;
});

export function useLoginInfo(botId: string) {
  console.log('botId', botId);

  const currentInfo = computed({
    get: () => allLoginInfos.value[botId]!,
    set: (val) => (allLoginInfos.value[botId] = val),
  });

  const autoRefresh = computed({
    get: () => currentInfo.value.autoRefresh,
    set: (val) => (currentInfo.value.autoRefresh = val),
  });
  const accessToken = computed(() => currentInfo.value.accessToken);

  const baseUrl = computed<string>(() => {
    const baseURL = currentInfo.value.apiUrl;
    if (baseURL === null) {
      return APIBASE;
    }
    if (!baseURL.endsWith(APIBASE)) {
      return `${baseURL}${APIBASE}`;
    }
    return `${baseURL}${APIBASE}`;
  });

  const baseWsUrl = computed<string>(() => {
    const baseURL = baseUrl.value;
    if (baseURL.startsWith('http://')) {
      return baseURL.replace('http://', 'ws://');
    }
    if (baseURL.startsWith('https://')) {
      return baseURL.replace('https://', 'wss://');
    }
    if (isProxiedBotUrl(baseURL)) {
      // Same-origin proxy route, so the upgrade is gated by the reports
      // BasicAuth credentials the bootstrap route established - the browser
      // attaches those itself. A handshake cannot carry a custom header, so
      // the bot's own auth is the ?token= JWT query freqtrade expects.
      const { pathname, search } = new URL(baseURL, window.location.origin);
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}${pathname}${search}`;
    }
    return '';
  });

  /**
   * Get login info for current bot
   */
  function getLoginInfo(): AuthStorage {
    const allLoginBot = allLoginInfos.value[botId];
    if (allLoginBot && 'apiUrl' in allLoginBot && 'refreshToken' in allLoginBot) {
      return allLoginBot;
    }
    return {
      botName: '',
      apiUrl: '',
      username: '',
      refreshToken: '',
      accessToken: '',
      autoRefresh: false,
    };
  }

  function updateBot(newValues: Partial<BotDescriptor>): void {
    Object.assign(currentInfo.value, newValues);
  }

  function setRefreshTokenExpired(): void {
    currentInfo.value.refreshToken = '';
    currentInfo.value.accessToken = '';
  }

  function logout(): void {
    console.log('Logging out');
    delete allLoginInfos.value[botId];
  }

  async function loginCall(auth: AuthPayload): Promise<AuthStorage> {
    const usesReportsProxy = isProxiedBotUrl(auth.url);
    const { data } = await axios.post<Record<string, never>, AxiosResponse<AuthResponse>>(
      `${auth.url}/api/v1/token/login`,
      {},
      {
        ...(usesReportsProxy
          ? {
              headers: {
                [BOT_AUTHORIZATION_HEADER]: encodeBasicAuthorization(auth.username, auth.password),
              },
            }
          : { auth: { username: auth.username, password: auth.password } }),
        withCredentials: true,
      },
    );
    if (data.access_token && data.refresh_token) {
      const obj: AuthStorage = {
        botName: auth.botName,
        apiUrl: auth.url,
        username: auth.username,
        accessToken: data.access_token || '',
        refreshToken: data.refresh_token || '',
        autoRefresh: true,
      };
      return Promise.resolve(obj);
    }
    return Promise.reject('login failed');
  }

  async function login(auth: AuthPayload) {
    const loginInfo = await loginCall(auth);
    currentInfo.value = loginInfo;
  }

  function refreshToken(): Promise<string> {
    console.log('Refreshing token...');
    const token = currentInfo.value.refreshToken;
    return new Promise((resolve, reject) => {
      axios
        .post<Record<string, never>, AxiosResponse<AuthResponse>>(
          `${currentInfo.value.apiUrl}${APIBASE}/token/refresh`,
          {},
          {
            headers: {
              [getBotAuthorizationHeaderName(currentInfo.value.apiUrl)]: `Bearer ${token}`,
            },
          },
        )
        .then((response) => {
          if (response.data.access_token) {
            currentInfo.value.accessToken = response.data.access_token;
            resolve(response.data.access_token);
          }
        })
        .catch((err) => {
          console.error(err);
          if (err.response && isReportsAuthChallenge(err.response.headers)) {
            // Caddy's reports gate refused the refresh, so the bot never saw
            // it. Keeping the refresh token means restoring reports auth is
            // enough to carry on - clearing it would force a full re-login.
            console.log('Reports authentication required - refresh was not proxied.');
            requireReportsAuth();
          } else if (err.response && err.response.status === 401) {
            console.log('Refresh token did not refresh.');
            setRefreshTokenExpired();
          } else if (err.response && (err.response.status === 500 || err.response.status === 404)) {
            console.log('Bot seems to be offline... - retrying later');
          }
          reject(err);
        });
    });
  }

  return {
    updateBot,
    getLoginInfo,
    autoRefresh,
    accessToken,
    logout,
    login,
    refreshToken,
    baseUrl,
    baseWsUrl,
  };
}
