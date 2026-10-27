import { create } from 'zustand';
import type { Operation, Toolpath } from '../core/job/job';
import { defaultOperation } from '../core/job/objectFactory';
import { fitsEasyMode } from '../core/job/toolpaths';
import { createBrowserStore } from '../persistence/keyValueStore';
import {
  createModePrefsRepository,
  type AppMode,
  type ModePrefs,
} from '../persistence/modePrefsRepository';
import type { Repository } from '../persistence/versionedRepository';

export interface ModeState extends ModePrefs {
  setMode: (mode: AppMode) => void;
  setEasyBit: (bitId: string) => void;
}

/** Easy or Pro, and Easy's bit; remembered between visits. */
export function createModeStore(repository: Repository<ModePrefs>) {
  const store = create<ModeState>()((set) => ({
    ...repository.load(),
    setMode: (mode) => set({ mode }),
    setEasyBit: (easyBitId) => set({ easyBitId }),
  }));
  store.subscribe(({ mode, easyBitId }) => repository.save({ mode, easyBitId }));
  return store;
}

export const useModeStore = createModeStore(createModePrefsRepository(createBrowserStore()));

/** The one bit Easy mode cuts with: the design's, else the remembered choice. */
export function easyBitId(toolpaths: readonly Toolpath[], remembered: string): string {
  return fitsEasyMode({ toolpaths }) && toolpaths[0] ? toolpaths[0].operation.bitId : remembered;
}

/**
 * The cut a newly added shape starts with. Easy engraves it with the job's bit
 * so there's always something to export; Pro adds shapes uncut and lets the
 * user pick cuts from the Toolpaths tab.
 */
export function newObjectOperation(
  toolpaths: readonly Toolpath[],
  s: ModePrefs = useModeStore.getState(),
): Operation | null {
  if (s.mode !== 'easy') return null;
  return { ...defaultOperation(), bitId: easyBitId(toolpaths, s.easyBitId) };
}
