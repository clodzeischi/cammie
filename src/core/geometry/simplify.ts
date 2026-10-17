import type { Path, Vec2 } from './path';

/** Distance from p to the segment a–b. */
function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Ramer–Douglas–Peucker: drop points that sit within `tolerance` of the line
 * through their neighbours. Iterative, so long paths can't overflow the stack.
 */
function simplifyPolyline(points: readonly Vec2[], tolerance: number): Vec2[] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Simplifies a path. Closed paths stay closed and keep at least a triangle. */
export function simplifyPath(path: Path, tolerance: number): Path {
  if (!path.closed) return { closed: false, points: simplifyPolyline(path.points, tolerance) };
  if (path.points.length < 4) return { closed: true, points: path.points.slice() };

  // Split the loop at the point farthest from the start, so both halves have
  // real endpoints to anchor on.
  const start = path.points[0]!;
  let far = 1;
  let farDist = 0;
  path.points.forEach((p, i) => {
    const d = Math.hypot(p.x - start.x, p.y - start.y);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  });
  const firstHalf = simplifyPolyline(path.points.slice(0, far + 1), tolerance);
  const secondHalf = simplifyPolyline([...path.points.slice(far), start], tolerance);
  const points = [...firstHalf, ...secondHalf.slice(1, -1)];
  return { closed: true, points: points.length >= 3 ? points : path.points.slice() };
}
