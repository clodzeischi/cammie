import { flattenCubic } from '../geometry/bezier';
import type { Path, Vec2 } from '../geometry/path';
import type { PolylineShape } from '../job/job';

/** Max distance (mm) between a curve and the straight segments drawn for it. */
const CURVE_TOLERANCE = 0.01;

/**
 * The outline of a drawn line or curve. With smoothing, each segment becomes
 * a Catmull-Rom curve through the points (tangents scaled by `smoothing`), so
 * the curve always passes through every point the user placed. Open curves
 * start and end flat against their first and last segment.
 */
export function polylinePath({ points, closed, smoothing }: PolylineShape): Path {
  const s = Math.min(Math.max(smoothing, 0), 1);
  if (s === 0 || points.length < 3) return { closed, points: [...points] };

  const n = points.length;
  const at = (i: number): Vec2 =>
    closed ? points[((i % n) + n) % n]! : points[Math.min(Math.max(i, 0), n - 1)]!;
  const out: Vec2[] = [points[0]!];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = s / 6;
    const c1 = { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k };
    const c2 = { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k };
    out.push(...flattenCubic(p1, c1, c2, p2, CURVE_TOLERANCE));
  }
  // A closed curve ends back on its first point, which closed paths don't repeat.
  if (closed) out.pop();
  return { closed, points: out };
}

/** Fewest points a line needs: two to stay open, three to close into a shape. */
export const MIN_POINTS = { open: 2, closed: 3 } as const;
