import type { KeyValueStore } from './keyValueStore';

/** What's actually written to storage: the data plus the schema version it was saved with. */
interface Envelope {
  version: number;
  data: unknown;
}

export interface RepositoryOptions<T> {
  key: string;
  version: number;
  defaults: () => T;
  /**
   * Turns whatever was stored (possibly old, partial or hand-edited) into a valid T.
   * Receives the stored schema version so old shapes can be migrated.
   */
  revive: (stored: unknown, storedVersion: number) => T;
}

export interface Repository<T> {
  load(): T;
  save(value: T): void;
  clear(): void;
}

export function createVersionedRepository<T>(
  store: KeyValueStore,
  options: RepositoryOptions<T>,
): Repository<T> {
  const { key, version, defaults, revive } = options;

  return {
    load() {
      const raw = store.get(key);
      if (raw === null) return defaults();
      try {
        const envelope = JSON.parse(raw) as Partial<Envelope>;
        if (typeof envelope.version !== 'number' || envelope.version > version) {
          // Unknown or newer-than-us data: don't guess, fall back to defaults.
          return defaults();
        }
        return revive(envelope.data, envelope.version);
      } catch {
        return defaults();
      }
    },
    save(value) {
      const envelope: Envelope = { version, data: value };
      store.set(key, JSON.stringify(envelope));
    },
    clear() {
      store.remove(key);
    },
  };
}
