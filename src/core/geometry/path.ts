/** Basic 2D geometry. All coordinates are millimetres unless a function says otherwise. */

export interface Vec2 {
  x: number;
  y: number;
}

/** A polyline. Closed paths don't repeat their first point at the end. */
export interface Path {
  points: Vec2[];
  closed: boolean;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);

export const EMPTY_BOUNDS: Bounds = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
};

export const isEmptyBounds = (b: Bounds): boolean => b.minX > b.maxX || b.minY > b.maxY;

export function boundsOfPoints(points: Iterable<Vec2>, start: Bounds = EMPTY_BOUNDS): Bounds {
  let { minX, minY, maxX, maxY } = start;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function boundsOfPaths(paths: readonly Path[]): Bounds {
  return paths.reduce((b, path) => boundsOfPoints(path.points, b), EMPTY_BOUNDS);
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Length along the path, including the closing segment for closed paths. */
export function pathLength(path: Path): number {
  const { points } = path;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1]!, points[i]!);
  if (path.closed && points.length > 2) length += distance(points[points.length - 1]!, points[0]!);
  return length;
}

/** Shoelace area. Sign depends on winding direction; use Math.abs for size. */
export function signedArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += (points[j]!.x - points[i]!.x) * (points[j]!.y + points[i]!.y);
  }
  return sum / 2;
}

export const scalePaths = (paths: readonly Path[], factor: number): Path[] =>
  paths.map((path) => ({
    closed: path.closed,
    points: path.points.map((p) => ({ x: p.x * factor, y: p.y * factor })),
  }));
