import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardMocks = vi.hoisted(() => ({
  initBots: vi.fn(),
  useBotStore: vi.fn(() => ({ hasBots: false })),
}));
vi.mock('@/stores/ftbotwrapper', () => ({ ...guardMocks }));
vi.mock('@/composables/dashboardRegistry', () => ({
  connectRegistryBots: vi.fn(async () => []),
  useDashboardRegistry: vi.fn(),
}));
const loginMocks = vi.hoisted(() => ({ loggedInBots: { value: {} as Record<string, unknown> } }));
vi.mock('@/composables/loginInfo', () => ({ ...loginMocks }));

import router from '@/router';

describe('comparison route guard', () => {
  beforeEach(async () => {
    await router.push('/');
    guardMocks.initBots.mockClear();
  });

  it('allows anonymous direct navigation to the comparison overview without initializing trading bots', async () => {
    await router.push('/compare/overview');
    expect(router.currentRoute.value.path).toBe('/compare/overview');
    expect(guardMocks.initBots).not.toHaveBeenCalled();
  });

  it('initializes already-connected bots on comparison pages', async () => {
    loginMocks.loggedInBots.value = { gmx: { botId: 'gmx' } };
    await router.push('/compare/pairs');
    expect(router.currentRoute.value.path).toBe('/compare/pairs');
    expect(guardMocks.initBots).toHaveBeenCalled();
    loginMocks.loggedInBots.value = {};
  });

  it('retains the normal login guard for trading routes', async () => {
    await router.push('/trade');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(guardMocks.initBots).toHaveBeenCalled();
  });
});
