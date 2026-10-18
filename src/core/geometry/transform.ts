import type { Path, Vec2 } from './path';

/**
 * How a design object sits on the stock: scale, then rotate (degrees,
 * clockwise on screen because Y points down), then translate. This matches
 * Konva's node attributes so the canvas and the CAM agree exactly.
 */
export interface ObjectTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export const IDENTITY_TRANSFORM: ObjectTransform = {
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};

/** 2D affine matrix [a c e; b d f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export function toMatrix(t: ObjectTransform): Matrix {
  const rad = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    a: cos * t.scaleX,
    b: sin * t.scaleX,
    c: -sin * t.scaleY,
    d: cos * t.scaleY,
    e: t.x,
    f: t.y,
  };
}

export const applyMatrix = (m: Matrix, p: Vec2): Vec2 => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});

export function transformPaths(paths: readonly Path[], t: ObjectTransform): Path[] {
  const m = toMatrix(t);
  return paths.map((path) => ({
    closed: path.closed,
    points: path.points.map((p) => applyMatrix(m, p)),
  }));
}

/** Inverse of an affine matrix (objects never have zero scale, so it always exists). */
export function invertMatrix(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}
