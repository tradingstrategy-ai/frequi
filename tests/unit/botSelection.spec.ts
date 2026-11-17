import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

vi.mock('@/composables/useToast', () => ({ useToast: () => ({ add: vi.fn() }) }));

// The login store reads its storage when its module loads, so the bots' logins are seeded first.
vi.hoisted(() => {
  const login = (botId: string, sortId: number) => ({
    botName: botId,
    apiUrl: `http://localhost/api/bots/${botId}`,
    accessToken: 'a',
    refreshToken: 'r',
    autoRefresh: false,
    sortId,
  });
  localStorage.setItem(
    'ftAuthLoginInfo',
    JSON.stringify({ 'first-bot': login('first-bot', 0), 'second-bot': login('second-bot', 1) }),
  );
});

import { useBotStore } from '@/stores/ftbotwrapper';

function store() {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({}).use(pinia);
  setActivePinia(pinia);
  const bots = useBotStore();
  for (const [sortId, botId] of ['first-bot', 'second-bot'].entries()) {
    bots.addBot({ botId, botName: botId, botUrl: `http://localhost/api/bots/${botId}`, sortId });
  }
  return bots;
}

describe('selectFirstBot', () => {
  beforeEach(() => localStorage.removeItem('ftSelectedBot'));

  it('restores the remembered bot', () => {
    localStorage.setItem('ftSelectedBot', 'second-bot');
    const bots = store();
    bots.selectFirstBot();
    expect(bots.selectedBot).toBe('second-bot');
  });

  it('falls back to the first bot when the remembered one is no longer offered', () => {
    localStorage.setItem('ftSelectedBot', 'renamed-or-removed');
    const bots = store();
    bots.selectFirstBot();
    expect(bots.selectedBot).toBe('first-bot');
  });
});

describe('startsSelected', () => {
  beforeEach(() => localStorage.removeItem('ftDashboardSelectedBots'));

  it('keeps FreqUI default (ticked) when no selection was ever saved', async () => {
    const { startsSelected } = await import('@/composables/dashboardRegistry');
    expect(startsSelected('any-bot', 'other')).toBe(true);
  });

  it('restores only the remembered bots and the one on screen after a reload', async () => {
    const { startsSelected } = await import('@/composables/dashboardRegistry');
    localStorage.setItem('ftDashboardSelectedBots', JSON.stringify(['first-bot']));
    expect(startsSelected('first-bot', 'x')).toBe(true);
    expect(startsSelected('second-bot', 'second-bot')).toBe(true);
    expect(startsSelected('third-bot', 'first-bot')).toBe(false);
  });
});
