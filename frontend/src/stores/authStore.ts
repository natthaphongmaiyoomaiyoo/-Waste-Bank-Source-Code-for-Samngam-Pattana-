import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';
import {
  clearAuthSession,
  getAuthItem,
  setAuthItem,
  startAuthSession,
} from 'src/utils/authStorage';

// Landing page per frontend role ('admin' | 'municipality' | 'committee' | 'user').
// Shared by the login page/dialog and the router guard so redirects stay in sync.
export function homePathForRole(role: string | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'municipality') return '/municipality';
  if (role === 'committee') return '/committee';
  if (role === 'buyer') return '/buyer/route-plan';
  return '/dashboard';
}

// The village a committee account is responsible for (null for other roles).
// Backend sends it on every session payload - see authService.publicUser.
export interface SessionVillageArea {
  id: number;
  villageName: string;
  moo: string | null;
  subdistrict: string | null;
  status: string;
}

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roleName: string;
  mustChangePassword: boolean;
  lastLogin: string | null;
  villageArea: SessionVillageArea | null;
}

export interface SessionMember {
  id: number;
  memberCode: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface LoginResponse {
  token: string;
  user: SessionUser;
  member: SessionMember | null;
}

type SessionResponse = Omit<LoginResponse, 'token'>;

function frontendRoleForBackendRole(roleName: string): string {
  return roleName === 'admin' ||
    roleName === 'municipality' ||
    roleName === 'committee' ||
    roleName === 'buyer'
    ? roleName
    : 'user';
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getAuthItem('authToken'),
    memberId: null as number | null,
    sessionChecked: false,
    mustChangePassword: getAuthItem('mustChangePassword') === 'true',
    user: null as SessionUser | null,
    member: null as SessionMember | null,
  }),

  getters: {
    // Committee's own village; null for every other role. Pages use it to scope
    // what they show - the backend enforces the same rule independently.
    myVillage: (state): SessionVillageArea | null => state.user?.villageArea ?? null,
    myVillageMoo(): string | null {
      return this.myVillage?.moo?.trim() || null;
    },
    myVillageLabel(): string {
      const village = this.myVillage;
      if (!village) return '';
      return [village.moo ? `หมู่ ${village.moo}` : null, village.villageName]
        .filter(Boolean)
        .join(' - ');
    },
  },

  actions: {
    // remember = the "จดจำฉันไว้" checkbox - see src/utils/authStorage.ts.
    async login(identifier: string, password: string, remember: boolean) {
      const { data } = await api.post<LoginResponse>('/auth/login', { identifier, password });

      this.token = data.token;
      this.memberId = data.member?.id ?? null;
      this.sessionChecked = true;
      this.mustChangePassword = data.user.mustChangePassword;
      this.user = data.user;
      this.member = data.member;

      startAuthSession(remember, {
        authToken: data.token,
        // Backend role vocabulary (admin/committee/municipality/buyer/member) ->
        // the frontend's 'admin' | 'municipality' | 'committee' | 'buyer' | 'user' vocabulary
        // (src/router/index.ts).
        role: frontendRoleForBackendRole(data.user.roleName),
        mustChangePassword: String(data.user.mustChangePassword),
      });

      return data;
    },

    // GET /auth/me without the session-check side effects (role/mustChangePassword
    // bookkeeping, logout-on-failure) - safe to call from the Profile page or
    // anywhere else that just wants a fresh copy of the current user/member.
    async fetchProfile() {
      const { data } = await api.get<SessionResponse>('/auth/me');
      this.user = data.user;
      this.member = data.member;
      return data;
    },

    async validateSession() {
      if (!this.token) {
        this.logout();
        return null;
      }

      try {
        const data = await this.fetchProfile();
        this.memberId = data.member?.id ?? null;
        this.sessionChecked = true;
        this.mustChangePassword = data.user.mustChangePassword;
        setAuthItem('role', frontendRoleForBackendRole(data.user.roleName));
        setAuthItem('mustChangePassword', String(data.user.mustChangePassword));
        return data;
      } catch (error) {
        this.logout();
        throw error;
      }
    },

    // Self-service profile edit (fullName/phone only - see backend updateMeSchema).
    async updateProfile(input: { fullName?: string; phone?: string }) {
      const { data } = await api.patch<SessionResponse>('/auth/me', input);
      this.user = data.user;
      this.member = data.member;
      return data;
    },

    async uploadAvatar(file: File) {
      const body = new FormData();
      body.append('avatar', file);
      const { data } = await api.post<SessionResponse>('/auth/me/avatar', body);
      this.user = data.user;
      this.member = data.member;
      return data;
    },

    async changePassword(currentPassword: string, newPassword: string) {
      await api.patch('/auth/password', { currentPassword, newPassword });
      this.mustChangePassword = false;
      setAuthItem('mustChangePassword', 'false');
    },

    async requestPasswordReset(identifier: string, phone: string, note?: string) {
      const { data } = await api.post<{
        message: string;
        resetToken?: string;
        // Committee accounts: verified by username + phone, set the password right away.
        directReset?: boolean;
      }>(
        '/auth/forgot-password',
        { identifier, phone, note },
      );
      return data;
    },

    async resetPassword(token: string, newPassword: string) {
      await api.post('/auth/reset-password', { token, newPassword });
    },

    logout() {
      this.token = null;
      this.memberId = null;
      this.sessionChecked = false;
      this.mustChangePassword = false;
      this.user = null;
      this.member = null;
      clearAuthSession();
    },
  },
});
