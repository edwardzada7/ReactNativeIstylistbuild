import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Stale-while-revalidate cache for screen data.
 * Screens render the last loaded data instantly and refresh in the background.
 * Public, non-personal lists (providers, shop, feed, provider profiles) are also saved to
 * the phone, so even the first screen after opening the app appears instantly.
 * Personal data (bookings, messages, dashboard) is memory-only and cleared on sign-out.
 */
const store = new Map<string, unknown>();
const STORAGE_KEY = 'screenCache:v1';
const PERSIST_PREFIXES = ['home-', 'shop-', 'feed-', 'provider-'];
const NEVER_PERSIST = ['provider-bookings', 'provider-dashboard'];

const isPersistable = (key: string) =>
  PERSIST_PREFIXES.some((p) => key.startsWith(p)) && !NEVER_PERSIST.includes(key);

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      const out: Record<string, unknown> = {};
      store.forEach((value, key) => {
        if (isPersistable(key)) out[key] = value;
      });
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(out)).catch(() => undefined);
    } catch {
      // storage is a convenience only
    }
  }, 1500);
}

export const screenCache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): T {
    store.set(key, value);
    if (isPersistable(key)) scheduleWrite();
    return value;
  },
  clear() {
    store.clear();
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  },
  /** Loads the saved public lists once at app start (before the first screen renders). */
  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      Object.entries(saved).forEach(([key, value]) => {
        if (isPersistable(key) && !store.has(key)) store.set(key, value);
      });
    } catch {
      // ignore a corrupt or unavailable cache
    }
  },
};
