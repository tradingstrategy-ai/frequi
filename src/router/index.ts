import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { handleHotUpdate, routes } from 'vue-router/auto-routes';
import { loggedInBots } from '@/composables/loginInfo';
import { connectRegistryBots } from '@/composables/dashboardRegistry';

const reportRoutes: RouteRecordRaw[] = [
  {
    path: '/reports',
    name: 'Live vs Backtest Reports',
    component: () => import('@/views/FleetReportsView.vue'),
    meta: { allowAnonymous: true },
  },
  {
    path: '/compare',
    component: () => import('@/views/comparison/ComparisonLayout.vue'),
    meta: { allowAnonymous: true },
    children: [
      { path: '', redirect: '/compare/overview' },
      {
        path: 'overview',
        name: 'Freqtrade Compare Overview',
        component: () => import('@/views/comparison/ComparisonOverview.vue'),
      },
      {
        path: 'execution',
        name: 'Freqtrade Compare Execution',
        component: () => import('@/views/comparison/ReportTabView.vue'),
        props: { tab: 'execution', heading: 'Execution quality, slippage and price impact' },
      },
      {
        path: 'universe',
        name: 'Freqtrade Compare Universe',
        component: () => import('@/views/comparison/ReportTabView.vue'),
        props: { tab: 'universe', heading: 'Trading universe, ranker and signal parity' },
      },
      {
        path: 'timeline',
        name: 'Freqtrade Compare Timeline',
        component: () => import('@/views/comparison/TradeTimeline.vue'),
      },
      {
        path: 'pairs',
        name: 'Freqtrade Compare Pairs',
        component: () => import('@/views/comparison/PairCategoryAnalysis.vue'),
      },
      {
        path: 'report',
        name: 'Freqtrade Compare Report',
        component: () => import('@/views/comparison/FleetReportTab.vue'),
      },
      {
        path: 'trades',
        name: 'Freqtrade Compare Deep Dive',
        component: () => import('@/views/comparison/TradeDeepDive.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...routes, ...reportRoutes],
});

router.beforeEach((to) => {
  if (to.path === '/compare' || to.path.startsWith('/compare/')) {
    if (Object.keys(loggedInBots.value).length > 0) initBots();
    else void connectRegistryBots();
    return true;
  }
  initBots();
  const botStore = useBotStore();
  if (!to.meta?.allowAnonymous && !botStore.hasBots) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

export function prefetchRoutePages(): void {
  const loaders = router
    .getRoutes()
    .flatMap((route) => Object.values(route.components ?? {}))
    .filter((component): component is () => Promise<unknown> => typeof component === 'function');
  const pending = [...new Set(loaders)];
  const worker = async () => {
    while (pending.length > 0) {
      const load = pending.shift();
      if (load) await load().catch(() => undefined);
    }
  };
  void Promise.all([worker(), worker()]);
}

if (import.meta.hot?.data) handleHotUpdate(router);

export default router;
