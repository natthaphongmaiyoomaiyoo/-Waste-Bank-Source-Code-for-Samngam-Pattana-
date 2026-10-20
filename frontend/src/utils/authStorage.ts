// Where the login session lives. "จดจำฉันไว้" ticked -> localStorage (survives
// closing the browser, until the JWT expires). Unticked -> sessionStorage (gone
// once the tab/browser closes). Every read/write of these keys goes through here
// so the router guard, axios and the auth store agree on which storage is active.
export type AuthStorageKey = 'authToken' | 'role' | 'mustChangePassword';

const AUTH_KEYS: AuthStorageKey[] = ['authToken', 'role', 'mustChangePassword'];

// A tab-only session wins over a remembered one: it was started in this tab.
export function getAuthItem(key: AuthStorageKey): string | null {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

// Updates a key inside the current session, keeping it in the storage it started in.
export function setAuthItem(key: AuthStorageKey, value: string) {
  const storage = sessionStorage.getItem('authToken') !== null ? sessionStorage : localStorage;
  storage.setItem(key, value);
}

export function startAuthSession(remember: boolean, values: Record<AuthStorageKey, string>) {
  clearAuthSession();
  const storage = remember ? localStorage : sessionStorage;
  for (const key of AUTH_KEYS) storage.setItem(key, values[key]);
}

export function clearAuthSession() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
