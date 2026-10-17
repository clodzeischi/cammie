import { boundsOfPaths, pathLength, signedArea, type Path } from './path';
import { simplifyPath } from './simplify';
import { applyMatrix, toMatrix, transformPaths } from './transform';

const square: Path = {
  closed: true,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
};

describe('path helpers', () => {
  it('measures length including the closing segment', () => {
    expect(pathLength(square)).toBe(40);
    expect(pathLength({ ...square, closed: false })).toBe(30);
  });

  it('computes area and bounds', () => {
    expect(Math.abs(signedArea(square.points))).toBe(100);
    expect(boundsOfPaths([square])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
});

describe('transform', () => {
  it('scales, rotates then translates', () => {
    const m = toMatrix({ x: 100, y: 50, rotation: 90, scaleX: 2, scaleY: 1 });
    const p = applyMatrix(m, { x: 1, y: 0 });
    // (1,0) → scaled (2,0) → rotated 90° clockwise on a Y-down screen (0,2) → +(100,50)
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(52);
  });

  it('transforms whole paths and keeps closed flags', () => {
    const [moved] = transformPaths([square], { x: 5, y: 5, rotation: 0, scaleX: 1, scaleY: 1 });
    expect(moved!.closed).toBe(true);
    expect(moved!.points[2]).toEqual({ x: 15, y: 15 });
  });
});

describe('simplifyPath', () => {
  it('removes collinear points from a closed loop', () => {
    const dense: Path = {
      closed: true,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 10, y: 10 },
        { x: 5, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 5 },
      ],
    };
    const simple = simplifyPath(dense, 0.01);
    expect(simple.closed).toBe(true);
    expect(simple.points).toHaveLength(4);
    expect(Math.abs(signedArea(simple.points))).toBe(100);
  });

  it('keeps detail larger than the tolerance', () => {
    const zigzag: Path = {
      closed: false,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ],
    };
    expect(simplifyPath(zigzag, 0.5).points).toHaveLength(3);
    expect(simplifyPath(zigzag, 2).points).toHaveLength(2);
  });
});
