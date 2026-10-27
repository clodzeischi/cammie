import { distance, type Vec2 } from '../../geometry/path';
import { APPROACH_CLEARANCE, type MoveWriter } from './moveWriter';

export interface DrillParams {
  /** Hole centres in machine coordinates. */
  points: readonly Vec2[];
  /** Depth reached by each peck; the last one is the hole's full depth. */
  depths: readonly number[];
}

/** Nearest-neighbour order from `start`, to keep the travel between holes short. */
export function orderPoints(points: readonly Vec2[], start: Vec2): Vec2[] {
  const remaining = [...points];
  const ordered: Vec2[] = [];
  let here = start;
  while (remaining.length > 0) {
    let best = 0;
    remaining.forEach((p, i) => {
      if (distance(here, p) < distance(here, remaining[best]!)) best = i;
    });
    here = remaining.splice(best, 1)[0]!;
    ordered.push(here);
  }
  return ordered;
}

/**
 * Peck drilling: feed down to each depth in turn, pulling up clear of the hole
 * after every peck but the last to clear the chips. The way back down is fed
 * at plunge speed, never rapid, so the tool can't crash into a clogged hole.
 */
export function cutDrill(writer: MoveWriter, { points, depths }: DrillParams): void {
  const here = writer.position;
  for (const p of orderPoints(points, { x: here.x, y: here.y })) {
    writer.approach(p, 0);
    depths.forEach((depth, i) => {
      writer.follow([{ x: p.x, y: p.y, z: -depth }]);
      if (i < depths.length - 1) writer.rapid(p.x, p.y, APPROACH_CLEARANCE);
    });
    writer.retract();
  }
}
