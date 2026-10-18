import { DEFAULT_GRID_SPACING, GRID_SPACINGS } from '../core/job/grid';
import type { KeyValueStore } from './keyValueStore';
import { createVersionedRepository, type Repository } from './versionedRepository';

export interface GridPrefs {
  /** Grid cell size (mm), one of GRID_SPACINGS. */
  spacing: number;
  /** Whether dragging and resizing snap to the grid. */
  snap: boolean;
}

export const GRID_PREFS_KEY = 'cammie.grid.v1';
export const DEFAULT_GRID_PREFS: GridPrefs = { spacing: DEFAULT_GRID_SPACING, snap: true };

export function reviveGridPrefs(stored: unknown): GridPrefs {
  const s = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  return {
    spacing: (GRID_SPACINGS as readonly unknown[]).includes(s.spacing)
      ? (s.spacing as number)
      : DEFAULT_GRID_PREFS.spacing,
    snap: typeof s.snap === 'boolean' ? s.snap : DEFAULT_GRID_PREFS.snap,
  };
}

export function createGridPrefsRepository(store: KeyValueStore): Repository<GridPrefs> {
  return createVersionedRepository(store, {
    key: GRID_PREFS_KEY,
    version: 1,
    defaults: () => ({ ...DEFAULT_GRID_PREFS }),
    revive: (stored) => reviveGridPrefs(stored),
  });
}
