import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

/** The 3D pane beside the canvas (SPEC.md §10.1). */
export interface View3DPrefs {
  open: boolean;
  /** Share of the workspace width the 3D pane takes. */
  share: number;
}

export const VIEW3D_PREFS_KEY = 'cammie.view3d.v1';
export const MIN_SHARE = 0.25;
export const MAX_SHARE = 0.75;
export const DEFAULT_VIEW3D_PREFS: View3DPrefs = { open: true, share: 0.45 };

export const clampShare = (share: number) => Math.min(Math.max(share, MIN_SHARE), MAX_SHARE);

export function reviveView3DPrefs(stored: unknown): View3DPrefs {
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  return {
    open: typeof s.open === 'boolean' ? s.open : DEFAULT_VIEW3D_PREFS.open,
    share:
      typeof s.share === 'number' && Number.isFinite(s.share)
        ? clampShare(s.share)
        : DEFAULT_VIEW3D_PREFS.share,
  };
}

export function createView3DPrefsRepository(store: KeyValueStore): Repository<View3DPrefs> {
  return createVersionedRepository(store, {
    key: VIEW3D_PREFS_KEY,
    version: 1,
    defaults: () => ({ ...DEFAULT_VIEW3D_PREFS }),
    revive: (stored) => reviveView3DPrefs(stored),
  });
}
