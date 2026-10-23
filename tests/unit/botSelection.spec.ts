import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

vi.mock('@/composables/useToast', () => ({ useToast: () => ({ add: vi.fn() }) }));

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
  beforeEach(() => localStorage.clear());

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
