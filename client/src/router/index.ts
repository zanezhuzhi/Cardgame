/**
 * Vue Router 配置
 * @file client/src/router/index.ts
 */

import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Lobby',
    component: () => import('../views/Lobby.vue'),
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('../App.vue'),
    props: (route: any) => ({
      mode: route.query.mode || 'single'
    })
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/** 开发构建：未显式传 devPanel 时默认带上 devPanel=1（传 devPanel=0 可关闭测试面板） */
if (import.meta.env.DEV) {
  router.beforeEach((to, _from, next) => {
    if (to.query.devPanel !== undefined) {
      next();
      return;
    }
    next({
      path: to.path,
      query: { ...to.query, devPanel: '1' },
      hash: to.hash,
      replace: true,
    });
  });
}

export default router;
