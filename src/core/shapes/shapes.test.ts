import { boundsOfPaths, signedArea, type Path } from '../geometry/path';
import { applyMatrix, toMatrix } from '../geometry/transform';
import { ellipsePath, rectPath } from './primitives';
import {
  createShapeObject,
  DEFAULT_RECT,
  withBakedScale,
  withGeometry,
  withShape,
} from './shapeObjects';

const areaError = (path: Path, expected: number) =>
  Math.abs(Math.abs(signedArea(path.points)) - expected);

const stock = { width: 200, height: 100, thickness: 6 };

describe('primitives', () => {
  it('draws rectangles with round corners that stay within the box', () => {
    const path = rectPath(40, 20, 5);
    expect(boundsOfPaths([path])).toEqual({ minX: 0, minY: 0, maxX: 40, maxY: 20 });
    // Area of a rounded rectangle: w·h − (4 − π)·r². Segments cut inside the true
    // curve, losing at most curve length × 0.01 mm tolerance.
    expect(areaError(path, 800 - (4 - Math.PI) * 25)).toBeLessThan(2 * Math.PI * 5 * 0.01);
  });

  it('limits the corner radius to half the shorter side', () => {
    const pill = rectPath(40, 10, 99);
    expect(areaError(pill, 400 - (4 - Math.PI) * 25)).toBeLessThan(2 * Math.PI * 5 * 0.01);
  });

  it('draws ellipses filling their box, smooth enough to cut', () => {
    const path = ellipsePath(60, 30);
    const b = boundsOfPaths([path]);
    expect(b.minX).toBeCloseTo(0);
    expect(b.maxX).toBeCloseTo(60);
    expect(b.maxY).toBeCloseTo(30, 1);
    expect(areaError(path, Math.PI * 30 * 15)).toBeLessThan(150 * 0.01); // perimeter ≈ 145 mm
  });
});

describe('shape objects', () => {
  it('bakes canvas stretching into the real size, keeping corners round', () => {
    const rect = createShapeObject('r', { ...DEFAULT_RECT, cornerRadius: 5 }, stock);
    const stretched = { ...rect, transform: { ...rect.transform, scaleX: 2, scaleY: 0.5 } };
    const baked = withBakedScale(stretched);
    expect(baked.shape).toEqual({ type: 'rect', width: 120, height: 20, cornerRadius: 5 });
    expect(baked.transform.scaleX).toBe(1);
    expect([baked.width, baked.height]).toEqual([120, 20]);
    // Same footprint on the stock as the stretched version.
    const corner = (o: typeof rect) =>
      applyMatrix(toMatrix(o.transform), { x: o.width, y: o.height });
    expect(corner(baked).x).toBeCloseTo(corner(stretched).x);
    expect(corner(baked).y).toBeCloseTo(corner(stretched).y);
  });

  it('leaves traced and imported objects scaled as they are', () => {
    const rect = createShapeObject('r', DEFAULT_RECT, stock);
    const svg = { ...rect, kind: 'svg' as const, shape: undefined };
    const scaled = { ...svg, transform: { ...svg.transform, scaleX: 2 } };
    expect(withBakedScale(scaled)).toBe(scaled);
  });

  it('changing the corner radius keeps the shape in place', () => {
    const rect = createShapeObject('r', DEFAULT_RECT, stock);
    const rounded = withShape(rect, { ...DEFAULT_RECT, cornerRadius: 8 });
    expect(rounded.transform).toEqual(rect.transform);
    expect(rounded.paths[0]!.points.length).toBeGreaterThan(4);
  });

  it('keeps the anchor point fixed when the geometry changes size, even rotated', () => {
    const rect = createShapeObject('r', DEFAULT_RECT, stock);
    const rotated = {
      ...rect,
      transform: { ...rect.transform, rotation: 30, scaleX: 2, scaleY: 2 },
    };
    const topRight = (o: typeof rect) => applyMatrix(toMatrix(o.transform), { x: o.width, y: 0 });
    const wider = withGeometry(rotated, [rectPath(90, 10)], { x: 1, y: 0 });
    expect(wider.width).toBe(90);
    expect(topRight(wider).x).toBeCloseTo(topRight(rotated).x);
    expect(topRight(wider).y).toBeCloseTo(topRight(rotated).y);
  });
});
