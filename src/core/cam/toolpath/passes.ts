/** Steepest angle (degrees) the tool descends at when ramping in. */
export const RAMP_ANGLE_DEG = 3;

/** Equal step-downs reaching exactly `depth`, none deeper than `depthPerPass`. */
export function passDepths(depth: number, depthPerPass: number): number[] {
  const count = Math.max(1, Math.ceil(depth / depthPerPass - 1e-9));
  return Array.from({ length: count }, (_, i) => (depth * (i + 1)) / count);
}

/**
 * Finishing passes only shave the walls, so they can go deep: one pass at full
 * depth, or two halves when that's more than twice the normal depth per pass
 * (SPEC.md §9.2).
 */
export function finishingDepths(depth: number, depthPerPass: number): number[] {
  return depth <= 2 * depthPerPass ? [depth] : [depth / 2, depth];
}

/** Distance along the path needed to descend `drop` mm at the ramp angle. */
export const rampLength = (drop: number): number =>
  drop / Math.tan((RAMP_ANGLE_DEG * Math.PI) / 180);
