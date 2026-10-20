import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import routes from './routes';
import { homePathForRole, useAuthStore } from 'src/stores/authStore';
import { getAuthItem } from 'src/utils/authStorage';

export default defineRouter(function () {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // AUTH + ROLE GUARD
  Router.beforeEach(async (to, from, next) => {
    const publicPaths = [
      '/',
      '/news',
      '/videos',
      '/forgot-password',
      '/apply-member',
      '/mid-components',
    ];
    const isPublicPath = publicPaths.includes(to.path) || to.path.startsWith('/news/');
    const authStore = useAuthStore();

    if (authStore.token && !authStore.sessionChecked) {
      try {
        await authStore.validateSession();
      } catch {
        if (!isPublicPath) {
          return next('/?login=1');
        }
      }
    }

    const role = getAuthItem('role');
    const token = getAuthItem('authToken');
    const isAuthenticated =
      (role === 'admin' ||
        role === 'user' ||
        role === 'municipality' ||
        role === 'committee' ||
        role === 'buyer') &&
      !!token;

    if (!isAuthenticated && !isPublicPath) {
      return next('/?login=1');
    }

    if (isAuthenticated && authStore.mustChangePassword && to.path !== '/change-password') {
      return next('/change-password');
    }

    if (isAuthenticated && to.path === '/') {
      return next(homePathForRole(role));
    }

    // ตรวจ role ของ route (ป้องกันพิมพ์ URL มั่วข้ามสิทธิ์)
    if (to.meta.role) {
      const allow = to.meta.role as string[];

      if (!role || !allow.includes(role)) {
        if (!isAuthenticated) {
          return next('/?login=1');
        }
        return next(homePathForRole(role));
      }
    }

    next();
  });

  return Router;
});
