import type { RouteRecordRaw } from 'vue-router';
import { loggedInBots } from '@/composables/loginInfo';
import { connectRegistryBots } from '@/composables/dashboardRegistry';
import { createRouter, createWebHistory } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: '/trade',
    name: 'Freqtrade Trading',
    component: () => import('@/views/TradingView.vue'),
  },
  {
    path: '/graph',
    name: 'Freqtrade Graph',
    component: () => import('@/views/ChartsView.vue'),
  },
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
      {
        path: '',
        redirect: '/compare/overview',
      },
      {
        path: 'overview',
        name: 'Freqtrade Compare Overview',
        component: () => import('@/views/comparison/ComparisonOverview.vue'),
      },
      {
        path: 'execution',
        name: 'Freqtrade Compare Execution',
        component: () => import('@/views/comparison/ReportTabView.vue'),
        props: {
          tab: 'execution',
          heading: 'Execution quality, slippage and price impact',
        },
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
  {
    path: '/logs',
    name: 'Freqtrade Logs',
    component: () => import('@/views/LogView.vue'),
  },
  {
    path: '/backtest',
    name: 'Freqtrade Backtest',
    component: () => import('@/views/BacktestingView.vue'),
  },
  {
    path: '/dashboard',
    name: 'Freqtrade Dashboard',
    component: () => import('@/views/DashboardView.vue'),
  },
  {
    path: '/balance',
    name: 'Freqtrade Balance',
    component: () => import('@/components/ftbot/BotBalance.vue'),
  },
  {
    path: '/open_trades',
    component: () => import('@/views/MobileTradesListView.vue'),
  },

  {
    path: '/trade_history',
    component: () => import('@/views/MobileTradesListView.vue'),
    props: { history: true },
  },
  {
    path: '/pairlist',
    component: () => import('@/components/ftbot/PairListLive.vue'),
  },
  {
    path: '/settings',
    name: 'Freqtrade Settings',
    component: () => import('@/views/SettingsView.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: '/pairlist_config',
    name: 'Pairlist Configuration',
    component: () => import('@/views/PairlistConfigView.vue'),
  },
  {
    path: '/download_data',
    name: 'Download Data',
    component: () => import('@/views/DownloadDataView.vue'),
  },
  {
    path: '/(.*)*',
    name: '404',
    component: () => import('@/views/Error404View.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  // Comparison has its own report-backed selection and works before any Freqtrade login.
  // Bots already connected in this browser are still initialized, so the navbar keeps
  // showing the selected bot when a comparison page is opened directly.
  if (to.path === '/compare' || to.path.startsWith('/compare/')) {
    if (Object.keys(loggedInBots.value).length > 0) {
      initBots();
    } else {
      // Cold load straight onto a comparison page: still connect the gateway's bots so
      // the navbar shows the bot and the other pages are ready (no-op without a gateway).
      void connectRegistryBots();
    }
    return true;
  }

  // Init normal trading bots here...
  initBots();
  const botStore = useBotStore();
  if (!to.meta?.allowAnonymous && !botStore.hasBots) {
    // Forward to login if login is required
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    };
  } else {
    return true;
  }
});

/**
 * Download every lazily loaded page now, while the browser is idle.
 *
 * Behind the dashboard gateway all bots share one origin over HTTP/1.1 (six connections
 * per host). A page whose code is fetched on first click can wait behind dozens of bot
 * polls and candle reads, so a click seems to do nothing for seconds.
 */
export function prefetchRoutePages(): void {
  const loaders = router
    .getRoutes()
    .flatMap((route) => Object.values(route.components ?? {}))
    .filter((component): component is () => Promise<unknown> => typeof component === 'function');
  void Promise.allSettled(loaders.map((load) => load()));
}

export default router;
