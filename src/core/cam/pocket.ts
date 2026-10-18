import { offsetRegion, regionOf } from '../clipper/clipper';
import { distance, type Path, type Vec2 } from '../geometry/path';
import type { CutDirection, EntryStyle } from '../job/job';
import { orderPaths } from './ordering';
import { Loop } from './toolpath/loop';
import { loopPass } from './toolpath/loopPass';
import type { MoveWriter } from './toolpath/moveWriter';
import { rampLength } from './toolpath/passes';

export interface PocketRings {
  /** Rings by offset level: [0] hugs the walls, the last is innermost. */
  levels: Path[][];
  /** The area the tool centre may travel in without touching the walls. */
  toolArea: Path[];
  /** Wall loops for the finishing pass (empty when there's no allowance). */
  finish: Path[];
  /** Spacing between rings (mm). */
  step: number;
  /** Some parts of the shape are too narrow for the bit. */
  lostDetail: boolean;
}

const reversed = (p: Path): Path => ({ closed: true, points: [...p.points].reverse() });

/**
 * Contour-parallel clearing rings (SPEC.md §9.4). Paths are machine
 * coordinates; closed paths are read with the even-odd rule, so inner shapes
 * become islands that are left standing.
 *
 * Direction: Clipper returns outer loops counter-clockwise and island loops
 * clockwise (Y up). Clearing outward, the uncut material is always on the right
 * of travel that way, which is climb milling for an M3 spindle.
 */
export function pocketRings(
  paths: readonly Path[],
  diameter: number,
  stepoverPercent: number,
  allowance: number,
  direction: CutDirection,
): PocketRings {
  const region = regionOf(paths);
  const radius = diameter / 2;
  const step = (diameter * stepoverPercent) / 100;
  const first = offsetRegion(region, -(radius + allowance));

  // Each ring is offset from the original shape, not from the previous ring:
  // re-offsetting re-rounds every corner and the vertex count snowballs.
  const levels: Path[][] = [];
  for (
    let ring = first;
    ring.length > 0 && levels.length < 10_000;
    ring = offsetRegion(region, -(radius + allowance + step * levels.length))
  ) {
    levels.push(ring);
  }
  const finish = allowance > 0 ? offsetRegion(region, -radius) : [];
  const orient = (loops: Path[]) => (direction === 'climb' ? loops : loops.map(reversed));
  return {
    levels: levels.map(orient),
    toolArea: first,
    finish: orient(finish),
    step,
    lostDetail: first.length < region.length,
  };
}

/** Does segment ab cross any edge of the loops? */
function crossesAny(a: Vec2, b: Vec2, loops: readonly Path[]): boolean {
  const cross = (o: Vec2, p: Vec2, q: Vec2) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  for (const loop of loops) {
    const pts = loop.points;
    for (let i = 0; i < pts.length; i++) {
      const c = pts[i]!;
      const d = pts[(i + 1) % pts.length]!;
      const d1 = cross(c, d, a);
      const d2 = cross(c, d, b);
      const d3 = cross(a, b, c);
      const d4 = cross(a, b, d);
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
  }
  return false;
}

export interface PocketMovesParams {
  rings: PocketRings;
  depths: readonly number[];
  entry: EntryStyle;
}

/**
 * Clears the pocket one depth at a time, innermost ring first and working out
 * to the walls. Between neighbouring rings the tool stays down; anywhere else
 * it lifts, travels and eases back in.
 */
export function cutPocket(writer: MoveWriter, { rings, depths, entry }: PocketMovesParams): void {
  const maxLink = rings.step * 2 + 0.01;
  let previousZ = 0;
  for (const depth of depths) {
    const z = -depth;
    let linked = false;
    for (let level = rings.levels.length - 1; level >= 0; level--) {
      let remaining = rings.levels[level]!;
      while (remaining.length > 0) {
        // Nearest ring next, rotated to start at its closest point.
        const here = writer.position;
        const [next, ...rest] = orderPaths(remaining, { x: here.x, y: here.y }).paths;
        remaining = rest;
        const loop = new Loop(next!);
        const start = loop.pointAt(0);
        const canLink =
          linked && distance(here, start) <= maxLink && !crossesAny(here, start, rings.toolArea);

        if (canLink) {
          writer.follow([{ x: start.x, y: start.y, z }]);
          writer.follow(
            loopPass({ loop, start: 0, fromZ: z, toZ: z, rampLength: 0, tabs: [], tabZ: -Infinity })
              .vertices,
          );
        } else {
          // Everything inside this ring was cleared to the previous depth already.
          writer.approach(start, previousZ);
          const ramp = entry === 'ramp' ? rampLength(previousZ - z) : 0;
          writer.follow(
            loopPass({
              loop,
              start: 0,
              fromZ: previousZ,
              toZ: z,
              rampLength: ramp,
              tabs: [],
              tabZ: -Infinity,
            }).vertices,
          );
        }
        linked = true;
      }
    }
    writer.retract();
    previousZ = z;
  }
}
