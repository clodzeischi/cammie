import { DEFAULT_VBIT_ID } from '../core/tools/bits';
import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

/** Easy: one bit, one cut per shape, plain words. Pro: the full toolpath list. */
export type AppMode = 'easy' | 'pro';

export interface ModePrefs {
  mode: AppMode;
  /** The bit Easy mode cuts with when the design has no cuts to take it from. */
  easyBitId: string;
}

export const MODE_PREFS_KEY = 'cammie.mode.v1';
/** New visitors start in Easy. */
export const DEFAULT_MODE_PREFS: ModePrefs = { mode: 'easy', easyBitId: DEFAULT_VBIT_ID };

export function reviveModePrefs(stored: unknown): ModePrefs {
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  return {
    mode: s.mode === 'pro' || s.mode === 'easy' ? s.mode : DEFAULT_MODE_PREFS.mode,
    easyBitId:
      typeof s.easyBitId === 'string' && s.easyBitId ? s.easyBitId : DEFAULT_MODE_PREFS.easyBitId,
  };
}

export function createModePrefsRepository(store: KeyValueStore): Repository<ModePrefs> {
  return createVersionedRepository(store, {
    key: MODE_PREFS_KEY,
    version: 1,
    defaults: () => ({ ...DEFAULT_MODE_PREFS }),
    revive: (stored) => reviveModePrefs(stored),
  });
}
