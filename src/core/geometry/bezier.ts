import type { Vec2 } from './path';

/** Max recursion when subdividing; 2^16 pieces is far beyond any useful detail. */
const MAX_DEPTH = 16;

/** Distance from p to the infinite line through a and b. */
function lineDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / length;
}

const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Points along a cubic Bézier (excluding the start point), close enough that no
 * part of the curve strays more than `tolerance` from the polyline.
 * Adaptive: tight curves get more points, near-straight ones fewer.
 */
export function flattenCubic(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2, tolerance: number): Vec2[] {
  const out: Vec2[] = [];
  const stack: Array<[Vec2, Vec2, Vec2, Vec2, number]> = [[p0, c1, c2, p3, 0]];
  while (stack.length > 0) {
    const [a, b, c, d, depth] = stack.pop()!;
    // The curve lies within its control polygon, so this bounds the error.
    const flat = Math.max(lineDistance(b, a, d), lineDistance(c, a, d)) <= tolerance;
    if (flat || depth >= MAX_DEPTH) {
      out.push(d);
      continue;
    }
    // de Casteljau split at t = 0.5; push the second half first so the first pops next.
    const ab = mid(a, b);
    const bc = mid(b, c);
    const cd = mid(c, d);
    const abc = mid(ab, bc);
    const bcd = mid(bc, cd);
    const m = mid(abc, bcd);
    stack.push([m, bcd, cd, d, depth + 1], [a, ab, abc, m, depth + 1]);
  }
  return out;
}

/** Quadratic control point → equivalent cubic control points. */
export function quadToCubic(p0: Vec2, q: Vec2, p: Vec2): [Vec2, Vec2] {
  return [
    { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
    { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) },
  ];
}

/**
 * SVG elliptical arc (endpoint form, SPEC F.6.5) → cubic Béziers of ≤ 90° each,
 * as [c1, c2, end] triples. Returns a straight line for degenerate radii.
 */
export function arcToCubics(
  from: Vec2,
  rxIn: number,
  ryIn: number,
  xAxisRotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Vec2,
): Array<[Vec2, Vec2, Vec2]> {
  if (from.x === to.x && from.y === to.y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [[from, to, to]];

  const phi = (xAxisRotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  // Step 1: move to a frame where the ellipse is axis-aligned, centred between the endpoints.
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;

  // Radii too small to reach: scale them up just enough.
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }

  // Step 2: centre in that frame.
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const factor = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (factor * rx * y1) / ry;
  const cy1 = (-factor * ry * x1) / rx;

  // Step 3: angles.
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  // Back to the original frame.
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const point = (t: number): Vec2 => ({
    x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  });
  const tangent = (t: number): Vec2 => ({
    x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  });

  const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / count;
  const k = (4 / 3) * Math.tan(step / 4);
  const cubics: Array<[Vec2, Vec2, Vec2]> = [];
  for (let i = 0; i < count; i++) {
    const t0 = theta1 + i * step;
    const t1 = t0 + step;
    const p0 = point(t0);
    const p1 = i === count - 1 ? to : point(t1);
    const d0 = tangent(t0);
    const d1 = tangent(t1);
    cubics.push([
      { x: p0.x + k * d0.x, y: p0.y + k * d0.y },
      { x: p1.x - k * d1.x, y: p1.y - k * d1.y },
      p1,
    ]);
  }
  return cubics;
}
