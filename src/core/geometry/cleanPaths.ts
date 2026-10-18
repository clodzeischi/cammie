import { distance, type Path } from './path';

/** Endpoints closer than this (mm) count as touching. */
export const JOIN_TOLERANCE = 0.01;

/**
 * Drops repeated points, marks paths whose ends meet as closed, and removes
 * paths too short to cut (SPEC.md §5.1 "clean-up on import").
 */
export function tidyPath(path: Path): Path | null {
  const points = path.points.filter((p, i, all) => i === 0 || distance(p, all[i - 1]!) > 1e-6);
  let closed = path.closed;
  if (points.length > 2 && distance(points[0]!, points[points.length - 1]!) <= JOIN_TOLERANCE) {
    closed = true;
    points.pop();
  }
  if (closed && points.length < 3) return null;
  if (points.length < 2) return null;
  return { closed, points };
}

/**
 * Joins open paths whose endpoints touch (reversing one if needed), so a shape
 * drawn as separate segments becomes one closed loop.
 */
export function joinOpenPaths(paths: readonly Path[]): Path[] {
  const closed = paths.filter((p) => p.closed);
  const open = paths.filter((p) => !p.closed).map((p) => p.points.slice());
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    distance(a, b) <= JOIN_TOLERANCE;

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < open.length && !merged; i++) {
      for (let j = i + 1; j < open.length && !merged; j++) {
        const a = open[i]!;
        const b = open[j]!;
        const joined = near(a.at(-1)!, b[0]!)
          ? [...a, ...b.slice(1)]
          : near(a.at(-1)!, b.at(-1)!)
            ? [...a, ...b.slice(0, -1).reverse()]
            : near(a[0]!, b.at(-1)!)
              ? [...b, ...a.slice(1)]
              : near(a[0]!, b[0]!)
                ? [...b.slice().reverse(), ...a.slice(1)]
                : null;
        if (joined) {
          open[i] = joined;
          open.splice(j, 1);
          merged = true;
        }
      }
    }
  }

  const tidied = open
    .map((points) => tidyPath({ closed: false, points }))
    .filter((p): p is Path => p !== null);
  return [...closed, ...tidied];
}
