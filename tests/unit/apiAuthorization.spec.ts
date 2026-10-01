import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ create: vi.fn(), post: vi.fn(), request: vi.fn() }));
vi.mock('axios', () => ({
  default: { create: axiosMock.create, post: axiosMock.post, request: axiosMock.request },
}));

const PROXY_BOT = {
  botName: 'Apex Vault',
  apiUrl: '/api/bots/apex',
  username: 'bot-user',
  refreshToken: 'refresh-token',
  accessToken: 'access-token',
  autoRefresh: true,
};

const DIRECT_BOT = {
  botName: 'Local bot',
  apiUrl: 'http://100.90.145.1:8101',
  username: 'bot-user',
  refreshToken: 'refresh-token',
  accessToken: 'access-token',
  autoRefresh: true,
};

function seedBot(botId: string, bot: Record<string, unknown>) {
  localStorage.setItem('ftAuthLoginInfo', JSON.stringify({ [botId]: bot }));
}

/** Install a stub axios instance and hand back the two interceptor handlers. */
function captureInterceptors() {
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  axiosMock.create.mockReturnValue({
    interceptors: { request: { use: requestUse }, response: { use: responseUse } },
  });
  return {
    requestHandler: () => requestUse.mock.calls[0]?.[0],
    responseSuccessHandler: () => responseUse.mock.calls[0]?.[0],
    responseErrorHandler: () => responseUse.mock.calls[0]?.[1],
  };
}

/** Minimal AxiosHeaders stand-in: the retry path calls .set() on it. */
function headersStub() {
  const store = new Map<string, string>();
  return {
    set: vi.fn((name: string, value: string) => store.set(name.toLowerCase(), value)),
    get: (name: string) => store.get(name.toLowerCase()),
    has: (name: string) => store.has(name.toLowerCase()),
  };
}

async function loadApi(botId: string) {
  const { useLoginInfo } = await import('@/composables/loginInfo');
  const { useApi } = await import('@/composables/api');
  const userService = useLoginInfo(botId);
  const interceptors = captureInterceptors();
  useApi(userService, botId);
  return { userService, ...interceptors };
}

describe('bot API authorization', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    axiosMock.create.mockReset();
    axiosMock.post.mockReset();
    axiosMock.request.mockReset();
    setActivePinia(createPinia());
  });

  it('puts bearer credentials in X-Bot-Authorization for a same-origin proxy', async () => {
    seedBot('apex', PROXY_BOT);
    const { requestHandler } = await loadApi('apex');

    const headers = headersStub();
    const request = { headers };
    expect(requestHandler()(request)).toBe(request);
    expect(headers.set).toHaveBeenCalledWith('X-Bot-Authorization', 'Bearer access-token');
    // The reports BasicAuth header is the browser's to manage - we must not touch it.
    expect(headers.has('Authorization')).toBe(false);
  });

  it('keeps using Authorization for a direct bot URL', async () => {
    seedBot('local', DIRECT_BOT);
    const { requestHandler } = await loadApi('local');

    const headers = headersStub();
    expect(requestHandler()({ headers })).toBeTruthy();
    expect(headers.set).toHaveBeenCalledWith('Authorization', 'Bearer access-token');
    expect(headers.has('X-Bot-Authorization')).toBe(false);
  });

  it('retries a 401 with the refreshed token in X-Bot-Authorization', async () => {
    seedBot('apex', PROXY_BOT);
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'fresh-token' } });
    axiosMock.request.mockResolvedValueOnce({ data: 'retried' });
    const { responseErrorHandler } = await loadApi('apex');

    const headers = headersStub();
    const config = { url: '/ping', headers };
    const response = await responseErrorHandler()({
      response: { status: 401, headers: {} },
      config,
    });

    expect(headers.set).toHaveBeenCalledWith('X-Bot-Authorization', 'Bearer fresh-token');
    expect(headers.has('Authorization')).toBe(false);
    expect(axiosMock.request).toHaveBeenCalledWith(config);
    expect(response).toEqual({ data: 'retried' });
  });

  it('retries a direct-URL 401 with the refreshed token in Authorization', async () => {
    seedBot('local', DIRECT_BOT);
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'fresh-token' } });
    axiosMock.request.mockResolvedValueOnce({ data: 'retried' });
    const { responseErrorHandler } = await loadApi('local');

    const headers = headersStub();
    await responseErrorHandler()({ response: { status: 401, headers: {} }, config: { headers } });

    expect(headers.set).toHaveBeenCalledWith('Authorization', 'Bearer fresh-token');
    expect(headers.has('X-Bot-Authorization')).toBe(false);
  });

  it('does not refresh or clear bot tokens when Caddy rejects the reports auth', async () => {
    seedBot('apex', PROXY_BOT);
    const { userService, responseErrorHandler } = await loadApi('apex');
    const { reportsAuthRequired } = await import('@/composables/reportsAuth');

    const err = {
      response: { status: 401, headers: { 'www-authenticate': 'Basic realm="restricted"' } },
      config: { headers: headersStub() },
    };
    await expect(responseErrorHandler()(err)).rejects.toBe(err);

    // The bot was never reached, so its credentials are still good.
    expect(axiosMock.post).not.toHaveBeenCalled();
    expect(userService.getLoginInfo().refreshToken).toBe('refresh-token');
    expect(userService.getLoginInfo().accessToken).toBe('access-token');
    expect(reportsAuthRequired.value).toBe(true);
  });

  it('keeps the bot logged in when the refresh itself hits the reports gate', async () => {
    // Race: the bot 401s on an expired JWT (no challenge), then reports auth
    // lapses before the refresh lands. The bot credentials are still good.
    seedBot('apex', PROXY_BOT);
    axiosMock.post.mockRejectedValueOnce({
      response: { status: 401, headers: { 'www-authenticate': 'Basic realm="restricted"' } },
    });
    const { userService, responseErrorHandler } = await loadApi('apex');
    const { reportsAuthRequired } = await import('@/composables/reportsAuth');
    const { useBotStore } = await import('@/stores/ftbotwrapper');
    const botStore = useBotStore();
    botStore.addBot({ botId: 'apex', botName: 'Apex Vault', botUrl: '/api/bots/apex', sortId: 1 });
    botStore.botStores['apex']!.isBotLoggedIn = true;

    await responseErrorHandler()({
      response: { status: 401, headers: {} },
      config: { headers: headersStub() },
    });

    expect(reportsAuthRequired.value).toBe(true);
    expect(userService.getLoginInfo().refreshToken).toBe('refresh-token');
    expect(botStore.botStores['apex']!.isBotLoggedIn).toBe(true);
    // No point retrying with a token we never received.
    expect(axiosMock.request).not.toHaveBeenCalled();
  });

  it('clears the reports auth prompt once a request succeeds again', async () => {
    seedBot('apex', PROXY_BOT);
    const { responseSuccessHandler, responseErrorHandler } = await loadApi('apex');
    const { reportsAuthRequired } = await import('@/composables/reportsAuth');

    await expect(
      responseErrorHandler()({
        response: { status: 401, headers: { 'www-authenticate': 'Basic realm="restricted"' } },
        config: { headers: headersStub() },
      }),
    ).rejects.toBeTruthy();
    expect(reportsAuthRequired.value).toBe(true);

    responseSuccessHandler()({ status: 200 });
    expect(reportsAuthRequired.value).toBe(false);
  });
});
