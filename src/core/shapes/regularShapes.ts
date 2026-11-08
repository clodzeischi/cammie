import type { Path, Vec2 } from '../geometry/path';
import type { CogShape, PolygonShape, StarShape } from '../job/job';
import { ellipsePath } from './primitives';

/**
 * Regular shapes, drawn around the centre of their width × height box with
 * Y pointing down. Each is built as a circle of diameter `width` and then
 * squashed to `height`, so stretching one keeps it symmetrical.
 */

export const SIDES_RANGE = { min: 3, max: 64 } as const;
export const STAR_POINTS_RANGE = { min: 3, max: 64 } as const;
export const TEETH_RANGE = { min: 3, max: 200 } as const;

/** Arcs on cog teeth are split into pieces no longer than this angle. */
const ARC_STEP = Math.PI / 90;

/** Unit-circle point at `angle` (radians, clockwise on screen from +X). */
const polar = (radius: number, angle: number): Vec2 => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

/** Places points built around (0, 0) in a circle of diameter `width` into the box. */
function intoBox(points: Vec2[], width: number, height: number): Path {
  const squash = width === 0 ? 1 : height / width;
  return {
    closed: true,
    points: points.map((p) => ({ x: width / 2 + p.x, y: height / 2 + p.y * squash })),
  };
}

/** Straight down on screen (Y points down). */
const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;

/** A regular polygon resting on a flat bottom edge (a square, not a diamond). */
export function polygonPath({ width, height, sides }: PolygonShape): Path {
  const n = Math.max(SIDES_RANGE.min, Math.round(sides));
  const start = DOWN + Math.PI / n;
  const points = Array.from({ length: n }, (_, i) =>
    polar(width / 2, start + (i * 2 * Math.PI) / n),
  );
  return intoBox(points, width, height);
}

/** A star with one point straight up. */
export function starPath({ width, height, points, innerRatio }: StarShape): Path {
  const n = Math.max(STAR_POINTS_RANGE.min, Math.round(points));
  const outer = width / 2;
  const inner = outer * Math.min(Math.max(innerRatio, 0.01), 0.99);
  const corners = Array.from({ length: n * 2 }, (_, i) =>
    polar(i % 2 === 0 ? outer : inner, UP + (i * Math.PI) / n),
  );
  return intoBox(corners, width, height);
}

/** The deepest a cog's teeth can go: they leave at least a tenth of the radius. */
export const maxToothDepth = (width: number) => (width / 2) * 0.9;

/** Points along an arc from a0 to a1 (radians), both ends included. */
function arc(radius: number, a0: number, a1: number): Vec2[] {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / ARC_STEP));
  return Array.from({ length: steps + 1 }, (_, i) => polar(radius, a0 + ((a1 - a0) * i) / steps));
}

/**
 * A gear-like wheel with straight-flanked teeth (one centred at the top) and
 * an optional centre hole. Teeth narrow towards the tip, so the gaps between
 * them are wider at the top than at the root, like a real cog.
 */
export function cogPaths(shape: CogShape): Path[] {
  const { width, height } = shape;
  const n = Math.max(TEETH_RANGE.min, Math.round(shape.teeth));
  const outer = width / 2;
  const root = outer - Math.min(Math.max(shape.toothDepth, 0), maxToothDepth(width));
  const pitch = (2 * Math.PI) / n;
  const base = pitch * Math.min(Math.max(shape.toothWidth, 0.05), 0.95);
  // The tip is 60% as wide as the root, measured as an angle.
  const tip = base * 0.6;

  const points: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const centre = UP + i * pitch;
    points.push(...arc(outer, centre - tip / 2, centre + tip / 2));
    points.push(...arc(root, centre + base / 2, centre + pitch - base / 2));
  }
  const paths = [intoBox(points, width, height)];

  // A hole that would cut into the teeth's roots is left out.
  const bore = shape.boreDiameter;
  if (bore > 0 && bore < root * 2) {
    const holeHeight = bore * (width === 0 ? 1 : height / width);
    const hole = ellipsePath(bore, holeHeight);
    const dx = (width - bore) / 2;
    const dy = (height - holeHeight) / 2;
    paths.push({ closed: true, points: hole.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) });
  }
  return paths;
}
