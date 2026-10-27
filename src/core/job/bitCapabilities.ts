import type { Bit } from '../tools/bits';
import type { CutKind } from './objectFactory';

/** Which cuts each kind of bit can make (SPEC.md §7.2). */
const CAN_CUT: Record<Bit['type'], readonly CutKind[]> = {
  flat: ['on', 'outside', 'inside', 'pocket'],
  // A cone or a ball can't cut a straight wall or a flat floor, so these only cut grooves.
  vbit: ['on'],
  round: ['on'],
};

export const canCut = (bit: Bit, kind: CutKind): boolean => CAN_CUT[bit.type].includes(kind);

/** The cut kinds this bit can make, in the given order. */
export const cutsFor = (bit: Bit, order: readonly CutKind[]): CutKind[] =>
  order.filter((kind) => canCut(bit, kind));

const PLURAL: Record<Bit['type'], string> = {
  flat: 'End mills',
  vbit: 'V-bits',
  round: 'Round-nose bits',
};

/** Why `bit` can't make a cut it doesn't support, in a sentence that says what to do instead. */
export function cantCutReason(bit: Bit): string {
  return `${PLURAL[bit.type]} only cut on the line. Pick an end mill for this cut.`;
}

/** The kind of bit a new cut of this kind prefers: V-bits for lines, end mills for the rest. */
export const preferredBitType = (kind: CutKind): Bit['type'] => (kind === 'on' ? 'vbit' : 'flat');
