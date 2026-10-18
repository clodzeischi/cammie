import type { Matrix } from '../../geometry/transform';

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** m1 ∘ m2: apply m2 first, then m1. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const translate = (x: number, y: number): Matrix => ({ ...IDENTITY, e: x, f: y });

function single(name: string, v: number[]): Matrix {
  const [p0 = 0, p1, p2, p3 = 0, p4 = 0, p5 = 0] = v;
  switch (name) {
    case 'matrix':
      return { a: p0, b: p1 ?? 0, c: p2 ?? 0, d: p3, e: p4, f: p5 };
    case 'translate':
      return translate(p0, p1 ?? 0);
    case 'scale':
      return { ...IDENTITY, a: p0, d: p1 ?? p0 };
    case 'rotate': {
      const cos = Math.cos(rad(p0));
      const sin = Math.sin(rad(p0));
      const r = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      if (p1 === undefined) return r;
      return multiply(multiply(translate(p1, p2 ?? 0), r), translate(-p1, -(p2 ?? 0)));
    }
    case 'skewX':
      return { ...IDENTITY, c: Math.tan(rad(p0)) };
    case 'skewY':
      return { ...IDENTITY, b: Math.tan(rad(p0)) };
    default:
      return IDENTITY;
  }
}

/** Parses an SVG `transform` attribute. "A B" means A applied after B. */
export function parseTransform(text: string | null): Matrix {
  if (!text) return IDENTITY;
  let result = IDENTITY;
  const pattern = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  for (const [, name, args] of text.matchAll(pattern)) {
    const values = args!
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    result = multiply(result, single(name!, values));
  }
  return result;
}
