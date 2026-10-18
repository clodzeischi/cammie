import type { Vec2 } from '../../geometry/path';
import type { Loop } from './loop';

/** Roughly one tab per this many mm of loop. */
const MM_PER_TAB = 100;
const MIN_TABS = 3;
const MAX_TABS = 8;
/** Corners sharper than this (degrees of turn) are bad places for a tab. */
const SHARP_TURN_DEG = 20;

/** Default tab count for a loop; fewer if they wouldn't fit with space between. */
export function autoTabCount(perimeter: number, width: number): number {
  const wanted = Math.min(MAX_TABS, Math.max(MIN_TABS, Math.round(perimeter / MM_PER_TAB)));
  return Math.min(wanted, Math.floor(perimeter / (2 * width)));
}

/** Largest direction change (degrees) at any vertex within [s0, s1]. */
function sharpestTurn(loop: Loop, s0: number, s1: number): number {
  let worst = 0;
  for (const s of loop.vertexPositionsBetween(s0, s1)) {
    const before = loop.pointAt(s - 0.05);
    const at = loop.pointAt(s);
    const after = loop.pointAt(s + 0.05);
    const a1 = Math.atan2(at.y - before.y, at.x - before.x);
    const a2 = Math.atan2(after.y - at.y, after.x - at.x);
    let turn = Math.abs(a2 - a1) * (180 / Math.PI);
    if (turn > 180) turn = 360 - turn;
    worst = Math.max(worst, turn);
  }
  return worst;
}

/**
 * Evenly spaced tab centres (mm along the loop), each nudged up to a quarter
 * of the spacing towards a straight stretch, away from corners (SPEC.md §9.3).
 */
export function autoTabPositions(loop: Loop, count: number, width: number): number[] {
  if (count <= 0) return [];
  const spacing = loop.perimeter / count;
  const steps = 10;
  return Array.from({ length: count }, (_, i) => {
    const ideal = (i + 0.5) * spacing;
    let best = ideal;
    let bestTurn = sharpestTurn(loop, ideal - width / 2, ideal + width / 2);
    for (let k = 1; k <= steps && bestTurn > SHARP_TURN_DEG; k++) {
      for (const sign of [1, -1]) {
        const s = ideal + (sign * k * spacing) / (4 * steps);
        const turn = sharpestTurn(loop, s - width / 2, s + width / 2);
        if (turn < bestTurn) {
          bestTurn = turn;
          best = s;
        }
      }
    }
    return best;
  });
}

/** Tab centres → lifted stretches of the loop. */
export const tabIntervals = (centres: readonly number[], width: number): Array<[number, number]> =>
  centres.map((c) => [c - width / 2, c + width / 2]);

/**
 * Assigns hand-placed tab points to the nearest loop (if within `maxDistance`)
 * and returns, per loop, the tab centres as positions along it.
 */
export function assignTabPoints(
  loops: readonly Loop[],
  points: readonly Vec2[],
  maxDistance: number,
): number[][] {
  const result = loops.map(() => [] as number[]);
  for (const p of points) {
    let bestLoop = -1;
    let bestS = 0;
    let bestDistance = maxDistance;
    for (let i = 0; i < loops.length; i++) {
      const c = loops[i]!.closest(p);
      if (c.distance <= bestDistance) {
        bestLoop = i;
        bestS = c.s;
        bestDistance = c.distance;
      }
    }
    if (bestLoop >= 0) result[bestLoop]!.push(bestS);
  }
  return result;
}
