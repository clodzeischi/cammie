import { boundsOfPaths, signedArea, type Path } from '../geometry/path';
import { isSolidBoundary, offsetRegion, regionOf } from './clipper';

const square = (x: number, y: number, size: number, clockwise = false): Path => {
  const points = [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
  return { closed: true, points: clockwise ? points.reverse() : points };
};

// A 20 mm square with a 10 mm square hole, given in arbitrary winding.
const frame = [square(0, 0, 20, true), square(5, 5, 10, true)];

describe('regionOf', () => {
  it('orients solid boundaries positive and holes negative, whatever the input winding', () => {
    const region = regionOf(frame);
    expect(region).toHaveLength(2);
    const outer = region.find((p) => Math.abs(signedArea(p.points)) > 200)!;
    const hole = region.find((p) => Math.abs(signedArea(p.points)) < 200)!;
    expect(isSolidBoundary(outer)).toBe(true);
    expect(isSolidBoundary(hole)).toBe(false);
  });

  it('ignores open paths', () => {
    expect(
      regionOf([
        {
          closed: false,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ],
        },
      ]),
    ).toEqual([]);
  });
});

describe('offsetRegion', () => {
  it('grows the outline and shrinks the hole', () => {
    const grown = offsetRegion(regionOf(frame), 1);
    expect(boundsOfPaths(grown)).toEqual({ minX: -1, minY: -1, maxX: 21, maxY: 21 });
    const hole = grown.find((p) => !isSolidBoundary(p))!;
    expect(boundsOfPaths([hole])).toEqual({ minX: 6, minY: 6, maxX: 14, maxY: 14 });
  });

  it('rounds outside corners within tolerance', () => {
    const [grown] = offsetRegion(regionOf([square(0, 0, 10)]), 2);
    // Corner arc: every point is ~2 mm from the square, none farther.
    for (const p of grown!.points) {
      const dx = Math.max(0 - p.x, 0, p.x - 10);
      const dy = Math.max(0 - p.y, 0, p.y - 10);
      expect(Math.hypot(dx, dy)).toBeCloseTo(2, 1);
    }
  });

  it('drops features narrower than the shrink', () => {
    const thin = {
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    expect(offsetRegion(regionOf([thin]), -1)).toEqual([]);
  });
});
