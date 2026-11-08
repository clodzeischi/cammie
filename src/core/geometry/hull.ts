import type { Bounds, Vec2 } from './path';
import { boundsOfPoints } from './path';

const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Convex hull (Andrew's monotone chain), counter-clockwise, without repeated points. */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const half = (list: Vec2[]) => {
    const out: Vec2[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** The points turned by `degrees` (clockwise on screen, Y down) about `pivot`. */
export function rotatePoints(points: readonly Vec2[], degrees: number, pivot: Vec2): Vec2[] {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => {
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
  });
}

const area = (b: Bounds) => (b.maxX - b.minX) * (b.maxY - b.minY);

/**
 * The turn (degrees, in [0, 90)) that gives the hull its smallest axis-aligned
 * box. The best box always has one side along a hull edge, so only those
 * angles need trying.
 */
export function tightestTurn(hull: readonly Vec2[]): number {
  let best = { degrees: 0, area: area(boundsOfPoints(hull)) };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const edge = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    // JavaScript's % keeps the sign, so shift into [0, 90).
    const degrees = ((-edge % 90) + 90) % 90;
    const turnedArea = area(boundsOfPoints(rotatePoints(hull, degrees, { x: 0, y: 0 })));
    if (turnedArea < best.area - 1e-9) best = { degrees, area: turnedArea };
  }
  return best.degrees;
}
