import { create } from 'zustand';
import { withGroupMates } from '../core/job/arrange';
import type { Toolpath } from '../core/job/job';
import { nestObjects, type NestOptions, type NestResult } from '../core/job/nesting';
import { findBit, grooveWidth, type Bit } from '../core/tools/bits';
import {
  createArrangePrefsRepository,
  type ArrangePrefs,
} from '../persistence/arrangePrefsRepository';
import { createBrowserStore } from '../persistence/keyValueStore';
import { useJobStore, type JobState } from './jobStore';

const repository = createArrangePrefsRepository(createBrowserStore());

/** Auto-arrange options remembered between visits. */
export const useArrangePrefs = create<ArrangePrefs & { setKeepRotation: (v: boolean) => void }>()(
  (set) => ({
    ...repository.load(),
    setKeepRotation: (keepRotation) => set({ keepRotation }),
  }),
);
useArrangePrefs.subscribe(({ keepRotation }) => repository.save({ keepRotation }));

/** The shapes auto-arrange moves: the selection (with whole groups), or every shape. */
export function nestTargets(s: Pick<JobState, 'objects' | 'selectedIds'>): string[] {
  return s.selectedIds.length > 0
    ? withGroupMates(s.objects, s.selectedIds)
    : s.objects.map((o) => o.id);
}

/** Extra room (mm) on top of the widest cut, so neighbouring cuts don't touch. */
const SPACING_MARGIN = 2;
const DEFAULT_SPACING = 5;

/**
 * A spacing that keeps the cuts apart: the widest groove any toolpath cuts,
 * plus a little, rounded up to half a millimetre.
 */
export function defaultSpacing(toolpaths: readonly Toolpath[], bits: readonly Bit[]): number {
  const widths = toolpaths.flatMap((t) => {
    const bit = findBit(t.operation.bitId, bits);
    return bit ? [grooveWidth(bit, t.operation.depth)] : [];
  });
  if (widths.length === 0) return DEFAULT_SPACING;
  return Math.ceil((Math.max(...widths) + SPACING_MARGIN) * 2) / 2;
}

/** Arranges the target shapes on the stock as one undo step. */
export function arrangeOnStock(options: NestOptions): NestResult {
  const s = useJobStore.getState();
  const result = nestObjects(s.objects, nestTargets(s), s.stock, options);
  if (result.placed > 0) s.setObjects(result.objects);
  return result;
}
