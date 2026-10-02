import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardMocks = vi.hoisted(() => ({
  initBots: vi.fn(),
  useBotStore: vi.fn(() => ({ hasBots: false })),
}));
vi.mock('@/stores/ftbotwrapper', () => ({ ...guardMocks }));

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

  it('retains the normal login guard for trading routes', async () => {
    await router.push('/trade');
    expect(router.currentRoute.value.path).toBe('/login');
    expect(guardMocks.initBots).toHaveBeenCalled();
  });
});
