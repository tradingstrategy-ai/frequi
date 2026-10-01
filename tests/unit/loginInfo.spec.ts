import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post: axiosMock.post } }));

describe('loginInfo demo preload', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('seeds every preset bot and selects ichiv3-ls-hyperliquid-live by default', async () => {
    const { seedDemoPresetBots, loggedInBots } = await import('@/composables/loginInfo');

    const seeded = seedDemoPresetBots(true);

    // Every preset bot should get seeded into local login storage.
    expect(seeded).toContain('ichiv2-ls-hyperliquid-live');
    expect(seeded).toContain('ichiv3-ls-hyperliquid-live');
    expect(seeded).toContain('ichiv3-ls-hyperliquid-vault-live');
    expect(seeded).toContain('ichiv3-ls-gate-static');
    expect(seeded).toContain('nt-opencz-vault');
    expect(seeded).toContain('nt-weekend-wick');
    expect(seeded).toContain('orchestrator_gmx_ai_gmx_vault');
    expect(seeded).toContain('orchestrator_apex_vault');
    expect(seeded).toContain('dipbuyer_apex_standalone');
    expect(seeded).toContain('derive-2sleeve-mainnet');
    expect(seeded.length).toBe(18); // 13 FT + 5 NT

    // The preferred starting bot is ichiv3 HL Live (top of fallback chain).
    expect(localStorage.getItem('ftSelectedBot')).toBe('ichiv3-ls-hyperliquid-live');

    // Each seeded bot ends up in the loggedInBots map with its preset URL.
    expect(loggedInBots.value['nt-opencz-vault']).toMatchObject({
      botName: 'NT OpenCZ Vault',
      botUrl: 'http://100.90.145.1:8101',
      sortId: 30,
    });
    expect(loggedInBots.value['ichiv2-ls-hyperliquid-live']).toMatchObject({
      botName: 'IchiV2 HL Live',
      botUrl: 'http://100.109.171.15:9100',
      sortId: 10,
    });
  });

  it('preserves a user-selected NT bot across page reloads', async () => {
    // Regression guard: previously seedDemoPresetBots forcibly reset the
    // selection to ichiv3 HL Live on every page load when the current
    // selection was an NT bot. That broke real NT vault navigation.
    localStorage.setItem('ftSelectedBot', 'nt-opencz-vault');

    const { seedDemoPresetBots } = await import('@/composables/loginInfo');
    seedDemoPresetBots(true);

    expect(localStorage.getItem('ftSelectedBot')).toBe('nt-opencz-vault');
  });

  it('preserves a custom (non-preset) bot across page reloads', async () => {
    // A bot the user added themselves should also survive — only an
    // unreachable selection (not in nextLoginInfos) triggers fallback.
    localStorage.setItem('ftSelectedBot', 'my-custom-bot');

    const { seedDemoPresetBots } = await import('@/composables/loginInfo');
    seedDemoPresetBots(true);

    // my-custom-bot isn't in any of the seeded presets, so the fallback
    // kicks in (this matches the unreachable-selection branch).
    expect(localStorage.getItem('ftSelectedBot')).toBe('ichiv3-ls-hyperliquid-live');
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
      url: 'http://100.90.145.1:8101',
      username: 'bot-user',
      password: 'bot-pass',
    });

    expect(axiosMock.post).toHaveBeenCalledWith(
      'http://100.90.145.1:8101/api/v1/token/login',
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
          apiUrl: 'http://100.90.145.1:8101',
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
      'http://100.90.145.1:8101/api/v1/token/refresh',
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
