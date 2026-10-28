import type { Operation, Toolpath } from '../core/job/job';
import { cutKindOf, newOperation, withCutKind, type CutKind } from '../core/job/objectFactory';
import { DEFAULT_FLAT_BIT_ID, DEFAULT_VBIT_ID, findBit, type Bit } from '../core/tools/bits';
import { useJobStore } from './jobStore';
import { easyBitId, useModeStore } from './modeStore';
import { useToolingStore } from './toolingStore';

/**
 * The bit a new cut of this kind should use: the one the job already uses for
 * that kind of work, so adding a cut doesn't add a bit change. Lines prefer
 * V-bits; everything else needs an end mill.
 */
export function bitForNewCut(kind: CutKind, toolpaths: readonly Toolpath[], bits: readonly Bit[]) {
  const wanted = kind === 'on' ? 'vbit' : 'flat';
  const used = [...toolpaths]
    .reverse()
    .map((t) => findBit(t.operation.bitId, bits))
    .find((b) => b?.type === wanted);
  return used?.id ?? (kind === 'on' ? DEFAULT_VBIT_ID : DEFAULT_FLAT_BIT_ID);
}

/** Pro: adds a cut of this kind to every selected object. */
export function addCutToSelection(kind: CutKind) {
  const { selectedIds, toolpaths, stock, addToolpaths } = useJobStore.getState();
  const bitId = bitForNewCut(kind, toolpaths, useToolingStore.getState().bits);
  addToolpaths(selectedIds, () => newOperation(kind, bitId, stock.thickness));
}

/**
 * Easy: switches the whole job to another bit. V-bits can only engrave, so
 * any other cut becomes an engraved line at the usual depth.
 */
export function setEasyBit(bitId: string) {
  const { toolpaths, setToolpaths, stock } = useJobStore.getState();
  useModeStore.getState().setEasyBit(bitId);
  const vbit = findBit(bitId, useToolingStore.getState().bits)?.type === 'vbit';
  const rebit = (op: Operation): Operation =>
    vbit && !(op.type === 'profile' && op.side === 'on')
      ? newOperation('on', bitId, stock.thickness)
      : { ...op, bitId };
  if (toolpaths.length === 0) return;
  setToolpaths(toolpaths.map((t) => ({ ...t, operation: rebit(t.operation) })));
}

/** Easy: gives each object the chosen kind of cut at that kind's usual depth. */
export function setEasyCut(objectIds: readonly string[], kind: CutKind | null) {
  const { toolpaths, stock, setObjectCuts } = useJobStore.getState();
  const bitId = easyBitId(toolpaths, useModeStore.getState().easyBitId);
  const cuts: Record<string, Operation | null> = {};
  for (const id of objectIds) {
    const current = toolpaths.find((t) => t.objectId === id)?.operation;
    if (!kind) cuts[id] = null;
    else if (current && cutKindOf(current) === kind) cuts[id] = current;
    else {
      const { depth } = newOperation(kind, bitId, stock.thickness);
      cuts[id] = withCutKind({ ...(current ?? newOperation(kind, bitId, 0)), bitId, depth }, kind);
    }
  }
  setObjectCuts(cuts);
}
