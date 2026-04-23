import type { RouteRecordRaw } from 'vue-router';
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
    path: '/compare',
    component: () => import('@/views/comparison/ComparisonLayout.vue'),
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
  // Init bots here...
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

export default router;
