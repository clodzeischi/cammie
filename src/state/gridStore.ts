import { create } from 'zustand';
import { createBrowserStore } from '../persistence/keyValueStore';
import { createGridPrefsRepository, type GridPrefs } from '../persistence/gridPrefsRepository';
import type { Repository } from '../persistence/versionedRepository';

export interface GridState extends GridPrefs {
  setSpacing: (spacing: number) => void;
  setSnap: (snap: boolean) => void;
}

/** Canvas grid size and snapping; remembered between visits. */
export function createGridStore(repository: Repository<GridPrefs>) {
  const store = create<GridState>()((set) => ({
    ...repository.load(),
    setSpacing: (spacing) => set({ spacing }),
    setSnap: (snap) => set({ snap }),
  }));
  store.subscribe(({ spacing, snap }) => repository.save({ spacing, snap }));
  return store;
}

export const useGridStore = createGridStore(createGridPrefsRepository(createBrowserStore()));
