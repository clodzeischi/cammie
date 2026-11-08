import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

export interface ArrangePrefs {
  /** Auto-arrange moves shapes without turning them. */
  keepRotation: boolean;
}

export const ARRANGE_PREFS_KEY = 'cammie.arrange.v1';
export const DEFAULT_ARRANGE_PREFS: ArrangePrefs = { keepRotation: false };

export function reviveArrangePrefs(stored: unknown): ArrangePrefs {
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  return {
    keepRotation:
      typeof s.keepRotation === 'boolean' ? s.keepRotation : DEFAULT_ARRANGE_PREFS.keepRotation,
  };
}

export function createArrangePrefsRepository(store: KeyValueStore): Repository<ArrangePrefs> {
  return createVersionedRepository(store, {
    key: ARRANGE_PREFS_KEY,
    version: 1,
    defaults: () => ({ ...DEFAULT_ARRANGE_PREFS }),
    revive: (stored) => reviveArrangePrefs(stored),
  });
}
