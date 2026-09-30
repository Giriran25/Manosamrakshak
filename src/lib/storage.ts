/**
 * Browser storage is treated as unreliable by design: it can be blocked, full
 * or cleared, and the app must render correctly without it. Only the session
 * and demo mode are ever written - never a token, secret, or personal data.
 */

export const readLocal = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeLocal = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable. The session simply does not survive a reload.
  }
};

export const clearLocal = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
};

export const STORAGE_KEYS = {
  session: 'manosamrakshak.session',
  mode: 'manosamrakshak.mode',
} as const;
