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

export default router;
