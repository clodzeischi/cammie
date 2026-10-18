import type { Matrix } from '../../geometry/transform';

/** CSS absolute units → mm. SVG user units are CSS px (1/96 in). */
const MM_PER_UNIT: Record<string, number> = {
  '': 25.4 / 96,
  px: 25.4 / 96,
  mm: 1,
  cm: 10,
  q: 0.25,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
};

export const MM_PER_PX = 25.4 / 96;

/** "100mm" → 100, "4in" → 101.6, "200" → 52.9 (px). null for %, em or garbage. */
export function lengthToMm(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  if (!match) return null;
  const factor = MM_PER_UNIT[match[2]!.toLowerCase()];
  return factor === undefined ? null : Number(match[1]) * factor;
}

/** Plain number attribute (user units), with a default for missing or bad values. */
export function numberAttr(value: string | null, fallback = 0): number {
  const n = value === null ? NaN : parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

interface RootSize {
  width: string | null;
  height: string | null;
  viewBox: string | null;
  preserveAspectRatio: string | null;
}

/**
 * Matrix from the root <svg>'s user units to millimetres (SPEC.md §5.1):
 * honours width/height units and the viewBox, defaulting to 96 DPI.
 */
export function rootMatrix(root: RootSize): Matrix {
  const box = (root.viewBox ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const hasBox = box.length === 4 && box.every(Number.isFinite) && box[2]! > 0 && box[3]! > 0;
  if (!hasBox) return { a: MM_PER_PX, b: 0, c: 0, d: MM_PER_PX, e: 0, f: 0 };

  const [vx, vy, vw, vh] = box as [number, number, number, number];
  const widthMm = lengthToMm(root.width);
  const heightMm = lengthToMm(root.height);
  const scaled = (sx: number, sy: number, tx = 0, ty = 0): Matrix => ({
    a: sx,
    b: 0,
    c: 0,
    d: sy,
    e: tx - vx * sx,
    f: ty - vy * sy,
  });

  if (widthMm !== null && heightMm !== null) {
    const sx = widthMm / vw;
    const sy = heightMm / vh;
    if (/\bnone\b/.test(root.preserveAspectRatio ?? '')) return scaled(sx, sy);
    // Default "xMidYMid meet": uniform scale, centred in the viewport.
    const s = Math.min(sx, sy);
    return scaled(s, s, (widthMm - vw * s) / 2, (heightMm - vh * s) / 2);
  }
  if (widthMm !== null) return scaled(widthMm / vw, widthMm / vw);
  if (heightMm !== null) return scaled(heightMm / vh, heightMm / vh);
  return scaled(MM_PER_PX, MM_PER_PX);
}
