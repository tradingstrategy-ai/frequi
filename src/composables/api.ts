import type { AxiosHeaders } from 'axios';
import axios from 'axios';
import {
  getBotAuthorizationHeaderName,
  isProxiedBotUrl,
  isReportsAuthChallenge,
} from '@/utils/botAuthorization';
import { clearReportsAuthRequirement, requireReportsAuth } from '@/composables/reportsAuth';

type UserServiceType = ReturnType<typeof useLoginInfo>;

export function useApi(userService: UserServiceType, botId: string) {
  const api = axios.create({
    baseURL: userService.baseUrl.value,
    timeout: 20000,
    withCredentials: true,
  });
  /**
   * Header this bot's own credentials travel in. Behind the reports proxy the
   * normal Authorization header belongs to the browser-managed reports
   * BasicAuth, so the bot token moves to the custom header Caddy rewrites.
   */
  const botAuthHeader = () => getBotAuthorizationHeaderName(userService.getLoginInfo().apiUrl);
  const isProxied = () => isProxiedBotUrl(userService.getLoginInfo().apiUrl);
  // Sent auth headers interceptor
  api.interceptors.request.use(
    (request) => {
      const token = userService.accessToken.value;
      try {
        if (token) {
          request.headers = request.headers as AxiosHeaders;
          request.headers.set(botAuthHeader(), `Bearer ${token}`);
        }
      } catch (e) {
        console.log(e);
      }
      return request;
    },
    (error) => Promise.reject(error),
  );

  api.interceptors.response.use(
    (response) => {
      if (isProxied()) {
        clearReportsAuthRequirement();
      }
      return response;
    },
    (err) => {
      // console.log(err);
      if (err.response && err.response.status === 401) {
        if (isReportsAuthChallenge(err.response.headers)) {
          // Caddy's reports gate answered, so the bot was never reached. Its
          // tokens are still valid - refreshing here would collect the same 401
          // and be misread as an expired refresh token, wiping the bot session.
          console.log('Reports authentication required - bot request was not proxied.');
          requireReportsAuth();
          const botStore = useBotStore();
          botStore.botStores[botId]?.setIsBotOnline(false);
          return Promise.reject(err);
        }
        return userService
          .refreshToken()
          .catch((error) => {
            console.log('No new token received');
            console.log(error);
            // Reports auth can lapse between the bot's 401 and the refresh.
            // Restoring it needs no bot credentials, so keep the bot logged in.
            const reportsAuthFailed = isReportsAuthChallenge(error?.response?.headers);
            if (reportsAuthFailed) {
              requireReportsAuth();
            }
            const botStore = useBotStore();
            if (botStore.botStores[botId]) {
              botStore.botStores[botId].setIsBotOnline(false);
              if (!reportsAuthFailed) {
                botStore.botStores[botId].isBotLoggedIn = false;
              }
            }
          })
          .then((token) => {
            if (!token) {
              // The refresh failed and the handler above recorded why. Retrying
              // with "Bearer undefined" would only collect another 401.
              return undefined;
            }
            // Retry original request with new token
            const { config } = err;
            config.headers.set(botAuthHeader(), `Bearer ${token}`);

            return new Promise((resolve, reject) => {
              axios
                .request(config)
                .then((response) => {
                  resolve(response);
                })
                .catch((error) => {
                  reject(error);
                });
            });
          })
          .catch((error) => {
            console.log(error);
          });

        // maybe redirect to /login if needed !
      }
      if ((err.response && err.response.status === 500) || err.message === 'Network Error') {
        console.log('Bot not running...');
        const botStore = useBotStore();
        botStore.botStores[botId]?.setIsBotOnline(false);
      }

      return new Promise((resolve, reject) => {
        reject(err);
      });
    },
  );

  return {
    api,
  };
}
