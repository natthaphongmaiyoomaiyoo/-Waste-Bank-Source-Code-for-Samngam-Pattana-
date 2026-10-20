import { defineBoot } from '#q-app/wrappers';
import axios, { type AxiosInstance } from 'axios';
import { clearAuthSession, getAuthItem } from 'src/utils/authStorage';

declare module 'vue' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
    $api: AxiosInstance;
  }
}

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, ''),
});

// Attach the JWT (same session storage the auth guard in src/router/index.ts already
// reads a 'role' string from) to every request that has one.
api.interceptors.request.use((config) => {
  const token = getAuthItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const isLoginRequest =
      axios.isAxiosError(error) && error.config?.url?.replace(/\/+$/, '') === '/auth/login';

    // A rejected login is handled by LoginDialog on the first page. Redirecting
    // here would close the dialog before its error notification can be shown.
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isLoginRequest) {
      clearAuthSession();
      if (window.location.hash.replace('#', '') !== '/?login=1') {
        window.location.hash = '#/?login=1';
      }
    }
    return Promise.reject(error as Error);
  },
);

export default defineBoot(({ app }) => {
  app.config.globalProperties.$axios = axios;
  app.config.globalProperties.$api = api;
});

export { api };
