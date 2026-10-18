import type { Path, Vec2 } from '../geometry/path';

/** Max distance (mm) between a true curve and the straight segments drawn for it. */
const CURVE_TOLERANCE = 0.01;

/** Segments needed so an arc of `radius` through `sweep` radians stays within tolerance. */
function segmentsFor(radius: number, sweep: number): number {
  if (radius <= CURVE_TOLERANCE) return 1;
  const maxStep = 2 * Math.acos(1 - CURVE_TOLERANCE / radius);
  return Math.max(1, Math.ceil(sweep / maxStep));
}

/** Largest corner radius a w × h rectangle can take. */
export const maxCornerRadius = (width: number, height: number) => Math.min(width, height) / 2;

/**
 * A w × h rectangle with its top-left at (0, 0) (Y down) and optional round
 * corners. The radius is limited to half the shorter side.
 */
export function rectPath(width: number, height: number, cornerRadius = 0): Path {
  const r = Math.max(0, Math.min(cornerRadius, maxCornerRadius(width, height)));
  if (r === 0) {
    return {
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ],
    };
  }
  // Corner centres, clockwise on screen from top-left, with each corner's start angle.
  const corners: Array<[Vec2, number]> = [
    [{ x: r, y: r }, Math.PI],
    [{ x: width - r, y: r }, -Math.PI / 2],
    [{ x: width - r, y: height - r }, 0],
    [{ x: r, y: height - r }, Math.PI / 2],
  ];
  const n = segmentsFor(r, Math.PI / 2);
  const points: Vec2[] = [];
  for (const [c, start] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = start + (i / n) * (Math.PI / 2);
      points.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
    }
  }
  // Fully rounded sides meet at a single point; drop the duplicates.
  return {
    closed: true,
    points: points.filter((p, i) => i === 0 || !samePoint(p, points[i - 1]!)),
  };
}

const samePoint = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

/** An ellipse filling the w × h box with its top-left at (0, 0). */
export function ellipsePath(width: number, height: number): Path {
  const rx = width / 2;
  const ry = height / 2;
  const n = Math.max(8, segmentsFor(Math.max(rx, ry), 2 * Math.PI));
  const points: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    points.push({ x: rx + rx * Math.cos(a), y: ry + ry * Math.sin(a) });
  }
  return { closed: true, points };
}
