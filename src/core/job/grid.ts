import type { Bounds, Vec2 } from '../geometry/path';

/** Grid spacings offered in the canvas controls (mm). */
export const GRID_SPACINGS = [0.5, 1, 2, 5, 10, 20, 25, 50] as const;
export const DEFAULT_GRID_SPACING = 10;

/** Round mm values that make good heavier "major" lines. */
const MAJOR_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000];

/**
 * Every how many lines a major (darker) line is drawn: the first round size of
 * at least five cells that's a whole number of cells (1 mm grid → every 5 mm,
 * 10 mm grid → every 50 mm).
 */
export function majorEvery(spacing: number): number {
  const major = MAJOR_STEPS.find((m) => m >= spacing * 5 && isMultiple(m, spacing));
  return major ? Math.round(major / spacing) : 5;
}

const isMultiple = (value: number, step: number) =>
  Math.abs(value / step - Math.round(value / step)) < 1e-9;

/** Grid line positions along one axis, from `from` to `to`, counted from `origin`. */
export function gridLines(from: number, to: number, origin: number, spacing: number) {
  const lines: Array<{ at: number; major: boolean }> = [];
  const every = majorEvery(spacing);
  const first = Math.ceil((from - origin) / spacing);
  const last = Math.floor((to - origin) / spacing);
  for (let i = first; i <= last; i++) {
    lines.push({ at: origin + i * spacing, major: i % every === 0 });
  }
  return lines;
}

/** Nearest grid line to `value` (grid lines pass through `origin`). */
export const snapValue = (value: number, origin: number, spacing: number) =>
  origin + Math.round((value - origin) / spacing) * spacing;

export const snapPoint = (p: Vec2, origin: Vec2, spacing: number): Vec2 => ({
  x: snapValue(p.x, origin.x, spacing),
  y: snapValue(p.y, origin.y, spacing),
});

/** Smallest move that puts either edge (`lo` or `hi`) on a grid line. */
function edgeSnap(lo: number, hi: number, origin: number, spacing: number): number {
  const toLo = snapValue(lo, origin, spacing) - lo;
  const toHi = snapValue(hi, origin, spacing) - hi;
  return Math.abs(toHi) < Math.abs(toLo) ? toHi : toLo;
}

/**
 * How far to move a box so it sits on the grid: on each axis, whichever of
 * its two edges is nearer a grid line goes onto it. Snapping edges (rather
 * than always the lower-left corner) lets a part line up on either side.
 */
export function snapBoxOffset(box: Bounds, origin: Vec2, spacing: number): Vec2 {
  return {
    x: edgeSnap(box.minX, box.maxX, origin.x, spacing),
    y: edgeSnap(box.minY, box.maxY, origin.y, spacing),
  };
}
