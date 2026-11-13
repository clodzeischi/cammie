/**
 * Thin adapter over Clipper2 (polygon booleans and offsetting). This is the only
 * file that knows about the library, so it can be swapped or upgraded in one place.
 */
import {
  EndType,
  FillRule,
  JoinType,
  areaD,
  differenceD,
  inflatePathsD,
  unionD,
  type PathsD,
} from '@countertype/clipper2-ts';
import { signedArea, type Path, type Vec2 } from '../geometry/path';

/** Coordinates are rounded to this many decimals (3 = 1 µm in mm space). */
const PRECISION = 3;
/** Max deviation when Clipper approximates round corners, in mm. */
const ARC_TOLERANCE = 0.005;

const toClipper = (paths: readonly Path[]): PathsD =>
  paths
    .filter((p) => p.closed && p.points.length >= 3)
    .map((p) => p.points.map(({ x, y }) => ({ x, y })));

const fromClipper = (paths: PathsD): Path[] =>
  paths.filter((p) => p.length >= 3).map((points) => ({ closed: true, points: points as Vec2[] }));

/**
 * The solid area enclosed by closed paths, using the even-odd rule: nested
 * outlines alternate solid/hole, which is how traced images and most SVG
 * artwork describe holes. Open paths are ignored.
 *
 * Returned outlines are oriented by role: solid boundaries have positive
 * `signedArea` (counter-clockwise with Y up), hole boundaries negative.
 */
export function regionOf(paths: readonly Path[]): Path[] {
  return fromClipper(unionD(toClipper(paths), FillRule.EvenOdd));
}

/**
 * Merges overlapping outlines using the non-zero rule, the way fonts are
 * filled: where two letters of a script font overlap, the result is one
 * outline instead of two crossing ones. Same orientation rules as `regionOf`.
 */
export function unionNonZero(paths: readonly Path[]): Path[] {
  return fromClipper(unionD(toClipper(paths), [], FillRule.NonZero, PRECISION));
}

/**
 * Grows (delta > 0) or shrinks (delta < 0) a region by `delta` mm with round
 * corners. Parts narrower than 2·|delta| disappear when shrinking.
 * Same orientation rules as `regionOf`.
 */
export function offsetRegion(region: readonly Path[], delta: number): Path[] {
  if (delta === 0) return region.map((p) => ({ closed: true, points: p.points.slice() }));
  return fromClipper(
    inflatePathsD(
      toClipper(region),
      delta,
      JoinType.Round,
      EndType.Polygon,
      2,
      PRECISION,
      ARC_TOLERANCE,
    ),
  );
}

/**
 * The area a round tool of `radius` sweeps following each path: a band around
 * a closed loop (a disc when the loop is smaller than the tool), a rounded
 * stroke along an open line, a disc at a single point. Oriented like `regionOf`.
 */
export function sweepPaths(paths: readonly Path[], radius: number): Path[] {
  const swept = paths.flatMap((p) => {
    const points = p.points.map(({ x, y }) => ({ x, y }));
    if (points.length === 0) return [];
    // A lone point has no direction to stroke along; give it a zero-length segment.
    const line = points.length === 1 ? [points[0]!, { ...points[0]! }] : points;
    const end = p.closed && points.length >= 3 ? EndType.Joined : EndType.Round;
    return inflatePathsD([line], radius, JoinType.Round, end, 2, PRECISION, ARC_TOLERANCE);
  });
  return fromClipper(unionD(swept, [], FillRule.NonZero, PRECISION));
}

/**
 * Area of `region` that lies outside all of `cover` (mm²). Both are oriented
 * like `regionOf`, so overlapping covers simply add up.
 */
export function uncoveredArea(region: readonly Path[], cover: readonly Path[]): number {
  const rest = differenceD(toClipper(region), toClipper(cover), FillRule.NonZero, PRECISION);
  return Math.abs(rest.reduce((sum, p) => sum + areaD(p), 0));
}

/** Solid boundary (true) or hole boundary (false), per the orientation rule above. */
export const isSolidBoundary = (path: Path): boolean => signedArea(path.points) > 0;
