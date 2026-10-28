import type { Bit } from '../tools/bits';
import type { CutKind } from './objectFactory';

/** Which cuts each kind of bit can make (SPEC.md §7.2). */
const CAN_CUT: Record<Bit['type'], readonly CutKind[]> = {
  flat: ['on', 'outside', 'inside', 'pocket', 'drill'],
  // A cone or a ball can't cut a straight wall or a flat floor; only a cone bevels an edge.
  vbit: ['on', 'chamfer'],
  round: ['on', 'drill'],
};

export const canCut = (bit: Bit, kind: CutKind): boolean => CAN_CUT[bit.type].includes(kind);

const PLURAL: Record<Bit['type'], string> = {
  flat: 'End mills',
  vbit: 'V-bits',
  round: 'Round-nose bits',
};

/** Why `bit` can't make a `kind` cut, in a sentence that says what to do instead. */
export function cantCutReason(bit: Bit, kind: CutKind): string {
  if (kind === 'chamfer') return 'Chamfers need a V-bit. Pick one for this cut.';
  if (kind === 'drill') return "V-bits can't drill holes. Pick an end mill or a round-nose bit.";
  return `${PLURAL[bit.type]} only cut on the line and ${
    bit.type === 'vbit' ? 'chamfer edges' : 'drill'
  }. Pick an end mill for this cut.`;
}

/** The kind of bit a new cut of this kind prefers: V-bits for lines and chamfers, end mills for the rest. */
export const preferredBitType = (kind: CutKind): Bit['type'] =>
  kind === 'on' || kind === 'chamfer' ? 'vbit' : 'flat';
