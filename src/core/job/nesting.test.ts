import { describe, expect, it } from 'vitest';
import { square } from '../cam/testFixtures';
import { boundsOfPoints, type Bounds, type Path } from '../geometry/path';
import { transformPaths } from '../geometry/transform';
import type { DesignObject } from './job';
import { nestObjects } from './nesting';

const stock = { width: 100, height: 60, thickness: 6 };

/** A w × h rectangle object whose top-left sits at (x, y) on the stock. */
function block(id: string, w: number, h: number, x = 0, y = 0, extra: Partial<DesignObject> = {}) {
  const path: Path = {
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
  };
  const object: DesignObject = {
    id,
    name: id,
    kind: 'svg',
    paths: [path],
    width: w,
    height: h,
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
  };
  return { ...object, ...extra };
}

const footprint = (o: DesignObject): Bounds =>
  boundsOfPoints(transformPaths(o.paths, o.transform).flatMap((p) => p.points));
const apart = (a: Bounds, b: Bounds, gap: number) =>
  a.maxX + gap <= b.minX + 1e-6 ||
  b.maxX + gap <= a.minX + 1e-6 ||
  a.maxY + gap <= b.minY + 1e-6 ||
  b.maxY + gap <= a.minY + 1e-6;
const insideStock = (b: Bounds, gap: number) =>
  b.minX >= gap - 1e-6 &&
  b.minY >= gap - 1e-6 &&
  b.maxX <= stock.width - gap + 1e-6 &&
  b.maxY <= stock.height - gap + 1e-6;

describe('auto-arrange', () => {
  it('packs parts onto the stock, apart from each other and the edges', () => {
    // Piled partly on top of each other, as after pasting a few times.
    const objects = [
      block('a', 40, 25, 30, 20),
      block('b', 30, 20, 45, 30, { groupId: 'x' }),
      block('c', 20, 20, 60, 50),
    ];
    const result = nestObjects(objects, ['a', 'b', 'c'], stock, { spacing: 4, keepRotation: true });
    expect(result).toMatchObject({ placed: 3, leftOut: 0 });
    const boxes = result.objects.map(footprint);
    boxes.forEach((b) => expect(insideStock(b, 4)).toBe(true));
    expect(apart(boxes[0]!, boxes[1]!, 4)).toBe(true);
    expect(apart(boxes[0]!, boxes[2]!, 4)).toBe(true);
    expect(apart(boxes[1]!, boxes[2]!, 4)).toBe(true);
    // Packed into the top-left corner.
    expect(Math.min(...boxes.map((b) => b.minX))).toBeCloseTo(4);
    expect(Math.min(...boxes.map((b) => b.minY))).toBeCloseTo(4);
  });

  it('turns a part that only fits sideways, unless rotation must be kept', () => {
    const tall = block('t', 10, 80, 0, 0);
    const turned = nestObjects([tall], ['t'], stock, { spacing: 2, keepRotation: false });
    expect(turned.placed).toBe(1);
    expect(Math.abs(turned.objects[0]!.transform.rotation) % 180).toBeCloseTo(90);
    expect(insideStock(footprint(turned.objects[0]!), 2)).toBe(true);

    const kept = nestObjects([tall], ['t'], stock, { spacing: 2, keepRotation: true });
    expect(kept).toMatchObject({ placed: 0, leftOut: 1 });
    expect(kept.objects[0]).toBe(tall);
  });

  it('turns a tilted part square to the stock when that packs tighter', () => {
    const tilted = {
      ...block('t', 50, 10, 30, 30),
      transform: { x: 30, y: 20, rotation: 30, scaleX: 1, scaleY: 1 },
    };
    const result = nestObjects([tilted], ['t'], stock, { spacing: 2, keepRotation: false });
    const b = footprint(result.objects[0]!);
    expect(Math.min(b.maxX - b.minX, b.maxY - b.minY)).toBeCloseTo(10);
  });

  it('keeps a shape and what lies inside it together, and works around shapes that stay put', () => {
    const plaque = block('plaque', 40, 20, 50, 30);
    const text = block('text', 30, 8, 55, 36);
    const fixed = block('fixed', 30, 30, 0, 0);
    const result = nestObjects([plaque, text, fixed], ['plaque', 'text'], stock, {
      spacing: 3,
      keepRotation: true,
    });
    const [p, t, f] = result.objects;
    expect(f).toBe(fixed);
    // The text moved exactly as far as the plaque did.
    expect(t!.transform.x - p!.transform.x).toBeCloseTo(5);
    expect(t!.transform.y - p!.transform.y).toBeCloseTo(6);
    expect(apart(footprint(p!), footprint(f!), 3)).toBe(true);
  });

  it('places what fits and reports the rest', () => {
    const objects = [block('a', 90, 50), block('b', 90, 50, 0, 100)];
    const result = nestObjects(objects, ['a', 'b'], stock, { spacing: 2, keepRotation: false });
    expect(result).toMatchObject({ placed: 1, leftOut: 1 });
  });

  it('ignores outlines it was not asked to move when counting parts', () => {
    const result = nestObjects(
      [block('a', 10, 10, 0, 0, { paths: [square(0, 0, 10)] })],
      [],
      stock,
      {
        spacing: 2,
        keepRotation: false,
      },
    );
    expect(result).toMatchObject({ placed: 0, leftOut: 0 });
  });
});
