/**
 * Tiny in-memory stale-while-revalidate cache for screen data.
 * Screens render the last loaded data instantly on revisit and refresh in the
 * background, instead of showing a full-screen spinner every time.
 */
const store = new Map<string, unknown>();

export const screenCache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  set<T>(key: string, value: T): T {
    store.set(key, value);
    return value;
  },
  clear() {
    store.clear();
  },
};
