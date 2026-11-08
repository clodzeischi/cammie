import { describe, expect, it } from 'vitest';
import { boundsOfPaths, distance, type Vec2 } from '../geometry/path';
import { applyMatrix, toMatrix } from '../geometry/transform';
import type { DesignObject } from '../job/job';
import { polylinePath } from './polyline';
import { cogPaths, polygonPath, starPath } from './regularShapes';
import {
  createPolylineObject,
  createShapeObject,
  DEFAULT_COG,
  DEFAULT_POLYGON,
  DEFAULT_STAR,
  withBakedScale,
  withShape,
} from './shapeObjects';

const stock = { width: 200, height: 100, thickness: 6 };
const onStock = (o: DesignObject) => {
  const m = toMatrix(o.transform);
  return o.paths.flatMap((p) => p.points.map((q) => applyMatrix(m, q)));
};
const radius = (p: Vec2) => Math.hypot(p.x - 20, p.y - 20);

describe('regular shapes', () => {
  it('rests polygons on a flat bottom edge, so four sides make a square', () => {
    const square = polygonPath({ ...DEFAULT_POLYGON, width: 40, height: 40, sides: 4 });
    const b = boundsOfPaths([square]);
    const side = 40 / Math.SQRT2;
    expect(b.maxX - b.minX).toBeCloseTo(side);
    expect(b.maxY - b.minY).toBeCloseTo(side);
    expect(square.points).toHaveLength(4);
  });

  it('draws stars with alternating outer and inner corners, one point straight up', () => {
    const star = starPath({ ...DEFAULT_STAR, width: 40, height: 40, points: 5, innerRatio: 0.5 });
    expect(star.points).toHaveLength(10);
    expect(star.points[0]!.x).toBeCloseTo(20);
    expect(star.points[0]!.y).toBeCloseTo(0);
    star.points.forEach((p, i) => expect(radius(p)).toBeCloseTo(i % 2 === 0 ? 20 : 10));
  });

  it('draws cogs with teeth reaching from the root to the tip, and a centre hole', () => {
    const [wheel, hole] = cogPaths({ ...DEFAULT_COG, width: 40, height: 40, toothDepth: 4 });
    const radii = wheel!.points.map(radius);
    expect(Math.max(...radii)).toBeCloseTo(20);
    expect(Math.min(...radii)).toBeCloseTo(16);
    // The hole is an 8 mm circle in the middle (flattened to within 0.01 mm).
    const b = boundsOfPaths([hole!]);
    expect(b.minX).toBeCloseTo(16, 1);
    expect(b.maxX).toBeCloseTo(24, 1);
  });

  it('leaves out a centre hole that would cut into the teeth', () => {
    expect(cogPaths({ ...DEFAULT_COG, width: 40, height: 40, boreDiameter: 35 })).toHaveLength(1);
  });

  it('keeps a polygon centred when its number of sides changes', () => {
    const hexagon = createShapeObject('p', DEFAULT_POLYGON, stock);
    const triangle = withShape(hexagon, { ...DEFAULT_POLYGON, sides: 3 });
    // The triangle's top corner is where the circle around both shapes meets its top.
    const top = onStock(triangle).reduce((a, b) => (b.y < a.y ? b : a));
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50 - 20);
  });

  it('bakes stretching into stars and cogs without moving any point', () => {
    for (const shape of [DEFAULT_STAR, DEFAULT_COG]) {
      const object = createShapeObject('s', shape, stock);
      const stretched = { ...object, transform: { ...object.transform, scaleX: 1.5, scaleY: 0.5 } };
      const baked = withBakedScale(stretched);
      expect(baked.transform.scaleX).toBe(1);
      // The outline lands in the same place. (A cog's centre hole is redrawn at its new
      // size with a different number of segments, so only its box is compared.)
      const outline = (o: DesignObject) => onStock({ ...o, paths: o.paths.slice(0, 1) });
      const before = outline(stretched);
      outline(baked).forEach((p, i) => expect(distance(p, before[i]!)).toBeLessThan(1e-9));
      const box = (o: DesignObject) => boundsOfPaths([{ closed: true, points: onStock(o) }]);
      expect(box(baked).minX).toBeCloseTo(box(stretched).minX, 6);
      expect(box(baked).maxY).toBeCloseTo(box(stretched).maxY, 6);
    }
  });
});

describe('lines and curves', () => {
  const zigzag = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
    { x: 30, y: 10 },
  ];

  it('joins the points with straight segments when not smoothed', () => {
    const path = polylinePath({ type: 'polyline', points: zigzag, closed: false, smoothing: 0 });
    expect(path.points).toEqual(zigzag);
  });

  it('passes a smoothed curve through every point', () => {
    const path = polylinePath({ type: 'polyline', points: zigzag, closed: false, smoothing: 1 });
    expect(path.points.length).toBeGreaterThan(zigzag.length);
    for (const p of zigzag) {
      expect(Math.min(...path.points.map((q) => distance(p, q)))).toBeLessThan(1e-9);
    }
  });

  it("doesn't repeat the first point at the end of a closed curve", () => {
    const path = polylinePath({ type: 'polyline', points: zigzag, closed: true, smoothing: 1 });
    expect(path.closed).toBe(true);
    expect(distance(path.points[0]!, path.points[path.points.length - 1]!)).toBeGreaterThan(0.01);
  });

  it('stays where it was drawn, with its points on its outline', () => {
    const drawn = [
      { x: 50, y: 40 },
      { x: 80, y: 60 },
      { x: 60, y: 90 },
    ];
    const line = createPolylineObject('l', drawn, false, 0);
    expect(line.transform).toMatchObject({ x: 50, y: 40 });
    expect(onStock(line)).toEqual(drawn);
    expect(line.name).toBe('Line');
    expect(createPolylineObject('c', drawn, false, 1).name).toBe('Curve');
  });

  it('moving one point leaves the others where they were', () => {
    const line = createPolylineObject(
      'l',
      [
        { x: 50, y: 40 },
        { x: 80, y: 60 },
        { x: 60, y: 90 },
      ],
      false,
      0,
    );
    if (line.shape?.type !== 'polyline') throw new Error('not a line');
    const points = line.shape.points.map((p, i) => (i === 0 ? { x: p.x - 20, y: p.y - 10 } : p));
    const moved = withShape(line, { ...line.shape, points });
    expect(onStock(moved)).toEqual([
      { x: 30, y: 30 },
      { x: 80, y: 60 },
      { x: 60, y: 90 },
    ]);
  });
});
