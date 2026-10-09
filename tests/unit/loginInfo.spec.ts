import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post: axiosMock.post } }));

describe('loginInfo demo preload', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('seeds every preset bot and selects the GMX AI Vault by default', async () => {
    const { seedDemoPresetBots, loggedInBots } = await import('@/composables/loginInfo');

    const seeded = seedDemoPresetBots(true);

    // Every preset bot should get seeded into local login storage.
    expect(seeded).toEqual([
      'orchestrator_gmx_ai_gmx_vault',
      'orchestrator_apex_vault',
      'dipbuyer_apex_standalone',
      'funding_tail_reversal_gmx_standalone',
      'derive-2sleeve-mainnet',
    ]);

    // The preferred starting bot is the GMX AI Vault (top of the fallback chain).
    expect(localStorage.getItem('ftSelectedBot')).toBe('orchestrator_gmx_ai_gmx_vault');

    // Each seeded bot ends up in the loggedInBots map with its preset URL.
    expect(loggedInBots.value['funding_tail_reversal_gmx_standalone']).toMatchObject({
      botName: 'Funding Tail Reversal GMX',
      botUrl: '/api/bots/ftr',
      sortId: 43,
    });
    expect(loggedInBots.value['derive-2sleeve-mainnet']).toMatchObject({
      botName: 'Derive 2 Sleeve',
      botUrl: '/api/bots/derive',
      sortId: 44,
    });
  });

  it('preserves a user-selected NT bot across page reloads', async () => {
    // Regression guard: previously seedDemoPresetBots forcibly reset the
    // selection to the default bot on every page load when the current
    // selection was an NT bot. That broke real NT vault navigation.
    localStorage.setItem('ftSelectedBot', 'derive-2sleeve-mainnet');

    const { seedDemoPresetBots } = await import('@/composables/loginInfo');
    seedDemoPresetBots(true);

    expect(localStorage.getItem('ftSelectedBot')).toBe('derive-2sleeve-mainnet');
  });

  it('falls back to the default bot when the selection is unreachable', async () => {
    // A selection that is in no login list triggers the fallback.
    localStorage.setItem('ftSelectedBot', 'my-custom-bot');

    const { seedDemoPresetBots } = await import('@/composables/loginInfo');
    seedDemoPresetBots(true);

    expect(localStorage.getItem('ftSelectedBot')).toBe('orchestrator_gmx_ai_gmx_vault');
  });

  it('sends proxy bot login credentials through X-Bot-Authorization', async () => {
    axiosMock.post.mockResolvedValueOnce({
      data: { access_token: 'access', refresh_token: 'refresh' },
    });
    const { useLoginInfo } = await import('@/composables/loginInfo');

    await useLoginInfo('orchestrator_apex_vault').login({
      botName: 'Apex Vault',
      url: '/api/bots/apex',
      username: 'bot-user',
      password: 'bot-pass',
    });

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/bots/apex/api/v1/token/login',
      {},
      {
        headers: { 'X-Bot-Authorization': 'Basic Ym90LXVzZXI6Ym90LXBhc3M=' },
        withCredentials: true,
      },
    );
  });

  it('sends proxy token refresh credentials through X-Bot-Authorization', async () => {
    localStorage.setItem(
      'ftAuthLoginInfo',
      JSON.stringify({
        derive: {
          botName: 'Derive',
          apiUrl: '/api/bots/derive',
          username: 'derive-user',
          refreshToken: 'derive-refresh-token',
          accessToken: 'old-token',
          autoRefresh: true,
        },
      }),
    );
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'new-token' } });
    const { useLoginInfo } = await import('@/composables/loginInfo');

    await expect(useLoginInfo('derive').refreshToken()).resolves.toBe('new-token');

    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/bots/derive/api/v1/token/refresh',
      {},
      { headers: { 'X-Bot-Authorization': 'Bearer derive-refresh-token' } },
    );
  });

  it('builds a same-origin WebSocket URL for proxied bot updates', async () => {
    const { seedDemoPresetBots, useLoginInfo } = await import('@/composables/loginInfo');
    seedDemoPresetBots(true);

    expect(useLoginInfo('orchestrator_apex_vault').baseWsUrl.value).toBe(
      'ws://localhost:3000/api/bots/apex/api/v1',
    );
  });

  it('leaves direct bot logins on the standard Authorization flow', async () => {
    axiosMock.post.mockResolvedValueOnce({
      data: { access_token: 'access', refresh_token: 'refresh' },
    });
    const { useLoginInfo } = await import('@/composables/loginInfo');

    await useLoginInfo('local').login({
      botName: 'Local bot',
      url: 'http://192.0.2.30:8101',
      username: 'bot-user',
      password: 'bot-pass',
    });

    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://192.0.2.30:8101/api/v1/token/login',
      {},
      {
        auth: { username: 'bot-user', password: 'bot-pass' },
        withCredentials: true,
      },
    );
  });

  it('leaves direct bot token refresh on the standard Authorization header', async () => {
    localStorage.setItem(
      'ftAuthLoginInfo',
      JSON.stringify({
        local: {
          botName: 'Local bot',
          apiUrl: 'http://192.0.2.30:8101',
          username: 'bot-user',
          refreshToken: 'local-refresh-token',
          accessToken: 'old-token',
          autoRefresh: true,
        },
      }),
    );
    axiosMock.post.mockResolvedValueOnce({ data: { access_token: 'new-token' } });
    const { useLoginInfo } = await import('@/composables/loginInfo');

    await expect(useLoginInfo('local').refreshToken()).resolves.toBe('new-token');

    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://192.0.2.30:8101/api/v1/token/refresh',
      {},
      { headers: { Authorization: 'Bearer local-refresh-token' } },
    );
  });

  it('routes a same-origin absolute proxy login through the custom header', async () => {
    axiosMock.post.mockResolvedValueOnce({
      data: { access_token: 'access', refresh_token: 'refresh' },
    });
    const { useLoginInfo } = await import('@/composables/loginInfo');

    await useLoginInfo('gmx').login({
      botName: 'GMX AI Vault',
      url: 'http://localhost:3000/api/bots/gmx',
      username: 'bot-user',
      password: 'bot-pass',
    });

    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://localhost:3000/api/bots/gmx/api/v1/token/login',
      {},
      {
        headers: { 'X-Bot-Authorization': 'Basic Ym90LXVzZXI6Ym90LXBhc3M=' },
        withCredentials: true,
      },
    );
  });
});
