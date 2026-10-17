/**
 * Minimal string storage. Repositories depend on this interface rather than on
 * `window.localStorage` directly, so tests can use an in-memory store.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * localStorage that never throws. Private windows, blocked site data or a full
 * quota make storage fail, and the app must keep working without it.
 */
export function createBrowserStore(): KeyValueStore {
  const storage = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

  return {
    get(key) {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage()?.setItem(key, value);
      } catch {
        // Storage unavailable: settings just won't survive a reload.
      }
    },
    remove(key) {
      try {
        storage()?.removeItem(key);
      } catch {
        // Nothing to clean up.
      }
    },
  };
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}
