import { create } from 'zustand';
import { createBrowserStore } from '../persistence/keyValueStore';
import { createGridPrefsRepository, type GridPrefs } from '../persistence/gridPrefsRepository';
import type { Repository } from '../persistence/versionedRepository';

export interface GridState extends GridPrefs {
  setSpacing: (spacing: number) => void;
  setSnap: (snap: boolean) => void;
  setShowCuts: (showCuts: boolean) => void;
}

/** Canvas grid size, snapping and whether cuts are shown; remembered between visits. */
export function createGridStore(repository: Repository<GridPrefs>) {
  const store = create<GridState>()((set) => ({
    ...repository.load(),
    setSpacing: (spacing) => set({ spacing }),
    setSnap: (snap) => set({ snap }),
    setShowCuts: (showCuts) => set({ showCuts }),
  }));
  store.subscribe(({ spacing, snap, showCuts }) => repository.save({ spacing, snap, showCuts }));
  return store;
}

export const useGridStore = createGridStore(createGridPrefsRepository(createBrowserStore()));
