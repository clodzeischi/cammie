/** Cutting bits. Dimensions in millimetres, angles in degrees. See SPEC.md §7. */

interface BitBase {
  id: string;
  name: string;
  flutes: number;
  /** Shank / cutting diameter. For a V-bit, the widest point of the cone. */
  diameter: number;
}

export interface FlatBit extends BitBase {
  type: 'flat';
}

export interface VBit extends BitBase {
  type: 'vbit';
  /** Included angle of the cone, e.g. 60 for a "60° V-bit". */
  angle: number;
  /** Width of the flat at the very tip (0 for a perfect point). */
  tipDiameter: number;
}

export type Bit = FlatBit | VBit;

const vbit = (angle: number, tip: number): VBit => ({
  id: `vbit-${angle}`,
  name: `V-bit ${angle}°`,
  type: 'vbit',
  angle,
  tipDiameter: tip,
  diameter: 3.175,
  flutes: 1,
});

export const BUILT_IN_BITS: readonly Bit[] = [
  vbit(20, 0.1),
  vbit(30, 0.1),
  vbit(60, 0.2),
  vbit(90, 0.2),
];

export const DEFAULT_VBIT_ID = 'vbit-60';

export const findBit = (id: string, bits: readonly Bit[] = BUILT_IN_BITS): Bit | undefined =>
  bits.find((bit) => bit.id === id);

/** Depth at which the cone reaches its full diameter; deeper cuts don't get wider. */
export function vbitMaxDepth(bit: VBit): number {
  return (bit.diameter - bit.tipDiameter) / 2 / Math.tan((bit.angle * Math.PI) / 360);
}

/** Width of the groove at the material surface when cutting `depth` mm deep. */
export function grooveWidth(bit: Bit, depth: number): number {
  if (bit.type === 'flat') return bit.diameter;
  const halfAngle = (bit.angle * Math.PI) / 360;
  return Math.min(bit.diameter, bit.tipDiameter + 2 * Math.max(depth, 0) * Math.tan(halfAngle));
}

/** Short filesystem-friendly label, e.g. "vbit-60" or "flat-3.175". */
export const bitSlug = (bit: Bit): string =>
  bit.type === 'vbit' ? `vbit-${bit.angle}` : `flat-${bit.diameter}`;
