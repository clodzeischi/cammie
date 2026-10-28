import { create } from 'zustand';
import { createBrowserStore } from '../persistence/keyValueStore';
import {
  clampShare,
  createView3DPrefsRepository,
  type View3DPrefs,
} from '../persistence/view3dPrefsRepository';
import type { Repository } from '../persistence/versionedRepository';

export interface View3DState extends View3DPrefs {
  toggle: () => void;
  setShare: (share: number) => void;
}

/** Whether the 3D pane is open and how wide it is; remembered between visits. */
export function createView3DStore(repository: Repository<View3DPrefs>) {
  const store = create<View3DState>()((set) => ({
    ...repository.load(),
    toggle: () => set((s) => ({ open: !s.open })),
    setShare: (share) => set({ share: clampShare(share) }),
  }));
  store.subscribe(({ open, share }) => repository.save({ open, share }));
  return store;
}

export const useView3DStore = createView3DStore(createView3DPrefsRepository(createBrowserStore()));
