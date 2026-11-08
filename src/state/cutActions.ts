import { canCut, preferredBitType } from '../core/job/bitCapabilities';
import type { Toolpath } from '../core/job/job';
import { newOperation, type CutKind } from '../core/job/objectFactory';
import { DEFAULT_FLAT_BIT_ID, DEFAULT_VBIT_ID, findBit, type Bit } from '../core/tools/bits';
import { useJobStore } from './jobStore';
import { useToolingStore } from './toolingStore';

/**
 * The bit a new cut of this kind should use: the one the job already uses for
 * that kind of work, so adding a cut doesn't add a bit change. Lines prefer
 * engraving bits (V-bit or round-nose); everything else needs an end mill.
 */
export function bitForNewCut(kind: CutKind, toolpaths: readonly Toolpath[], bits: readonly Bit[]) {
  const suits = (b: Bit) =>
    canCut(b, kind) && (preferredBitType(kind) === 'flat') === (b.type === 'flat');
  const used = [...toolpaths]
    .reverse()
    .map((t) => findBit(t.operation.bitId, bits))
    .find((b) => b && suits(b));
  return used?.id ?? (preferredBitType(kind) === 'vbit' ? DEFAULT_VBIT_ID : DEFAULT_FLAT_BIT_ID);
}

/** Adds a cut of this kind to every selected object. */
export function addCutToSelection(kind: CutKind) {
  const { selectedIds, toolpaths, stock, addToolpaths } = useJobStore.getState();
  const bitId = bitForNewCut(kind, toolpaths, useToolingStore.getState().bits);
  addToolpaths(selectedIds, () => newOperation(kind, bitId, stock.thickness));
}
