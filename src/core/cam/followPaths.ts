import type { Path, Vec2 } from '../geometry/path';
import type { Feeds } from '../materials/materials';
import type { Move } from './program';

/** Height above the material where rapids stop and the feed down begins. */
const APPROACH_CLEARANCE = 0.5;

/** Equal step-downs reaching exactly `depth`, none deeper than `depthPerPass`. */
export function passDepths(depth: number, depthPerPass: number): number[] {
  const count = Math.max(1, Math.ceil(depth / depthPerPass - 1e-9));
  return Array.from({ length: count }, (_, i) => (depth * (i + 1)) / count);
}

export interface FollowParams {
  depth: number;
  feeds: Feeds;
  safeZ: number;
}

/**
 * Runs the tool along each path at a fixed depth, stepping down in passes.
 * Used by every profile cut: the paths are the line itself or its offset. Closed loops go round once per pass; open paths go back and forth,
 * so the tool stays in the groove between passes. Paths must be in machine
 * coordinates and already ordered. Starts and ends at safe Z.
 */
export function followPaths(paths: readonly Path[], params: FollowParams): Move[] {
  const { feeds, safeZ } = params;
  const depths = passDepths(params.depth, feeds.depthPerPass);
  const approachZ = Math.min(APPROACH_CLEARANCE, safeZ);
  const moves: Move[] = [];
  const rapid = (p: Vec2, z: number) => moves.push({ kind: 'rapid', x: p.x, y: p.y, z });
  const feed = (p: Vec2, z: number, f: number) =>
    moves.push({ kind: 'feed', x: p.x, y: p.y, z, feed: f });

  for (const path of paths) {
    const first = path.points[0];
    if (!first) continue;
    rapid(first, safeZ);
    rapid(first, approachZ);

    let forward = true;
    for (const depth of depths) {
      const z = -depth;
      const here = moves[moves.length - 1]!;
      feed({ x: here.x, y: here.y }, z, feeds.plunge);

      if (path.closed) {
        for (const p of path.points.slice(1)) feed(p, z, feeds.feed);
        feed(first, z, feeds.feed);
      } else {
        const points = forward ? path.points : [...path.points].reverse();
        for (const p of points.slice(1)) feed(p, z, feeds.feed);
        forward = !forward;
      }
    }

    const last = moves[moves.length - 1]!;
    rapid({ x: last.x, y: last.y }, safeZ);
  }
  return moves;
}
