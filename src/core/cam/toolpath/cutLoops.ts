import type { Path, Vec2 } from '../../geometry/path';
import type { EntryStyle } from '../../job/job';
import { orderPaths } from '../ordering';
import { Loop } from './loop';
import { loopPass } from './loopPass';
import type { MoveWriter } from './moveWriter';
import { rampLength } from './passes';
import { assignTabPoints, tabIntervals } from './tabs';

export interface TabPlan {
  /** Tab centres in machine coordinates; each snaps to the nearest loop. */
  points: Vec2[];
  width: number;
  /** Top of the tabs (negative Z). */
  z: number;
  /** How far a point may be from a loop and still count as on it. */
  snapDistance: number;
}

export interface CutLoopsParams {
  paths: readonly Path[];
  depths: readonly number[];
  entry: EntryStyle;
  tabs: TabPlan | null;
}

/**
 * Cuts each path to its full depth before moving on (keeps parts rigid; SPEC.md
 * §9.7). Closed loops step down with a ramp or plunge per pass; open paths
 * plunge and go back and forth, so the tool stays in its groove.
 */
export function cutLoops(writer: MoveWriter, params: CutLoopsParams): void {
  const { paths, depths, entry, tabs } = params;
  const here = writer.position;
  const ordered = orderPaths(paths, { x: here.x, y: here.y }).paths;
  const closed = ordered.filter((p) => p.closed).map((p) => new Loop(p));
  const tabCentres = tabs ? assignTabPoints(closed, tabs.points, tabs.snapDistance) : [];

  let loopIndex = 0;
  for (const path of ordered) {
    if (path.closed) {
      const centres = tabCentres[loopIndex] ?? [];
      cutClosed(writer, closed[loopIndex++]!, depths, entry, tabs, centres);
    } else {
      cutOpen(writer, path, depths);
    }
    writer.retract();
  }
}

function cutClosed(
  writer: MoveWriter,
  loop: Loop,
  depths: readonly number[],
  entry: EntryStyle,
  tabs: TabPlan | null,
  centres: number[],
) {
  const intervals = tabs ? tabIntervals(centres, tabs.width) : [];
  writer.approach(loop.pointAt(0), 0);
  let s = 0;
  let z = 0;
  for (const depth of depths) {
    const toZ = -depth;
    const pass = loopPass({
      loop,
      start: s,
      fromZ: z,
      toZ,
      rampLength: entry === 'ramp' ? rampLength(z - toZ) : 0,
      tabs: intervals,
      tabZ: tabs?.z ?? -Infinity,
    });
    writer.follow(pass.vertices);
    s = pass.end;
    z = toZ;
  }
}

function cutOpen(writer: MoveWriter, path: Path, depths: readonly number[]) {
  writer.approach(path.points[0]!, 0);
  let points = path.points;
  for (const depth of depths) {
    const start = points[0]!;
    writer.follow([{ x: start.x, y: start.y, z: -depth }]);
    writer.follow(points.slice(1).map((p) => ({ x: p.x, y: p.y, z: -depth })));
    points = [...points].reverse();
  }
}
