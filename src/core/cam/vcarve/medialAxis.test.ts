import type { Path } from '../../geometry/path';
import { medialAxis, type MedialPoint } from './medialAxis';

const rect = (x: number, y: number, w: number, h: number): Path => ({
  closed: true,
  points: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

const circle = (cx: number, cy: number, r: number, n = 360): Path => ({
  closed: true,
  points: Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / n),
    y: cy + r * Math.sin((2 * Math.PI * i) / n),
  })),
});

const all = (chains: MedialPoint[][]) => chains.flat();

describe('medialAxis', () => {
  it('runs a rectangle along its middle, out to each corner', () => {
    const { chains } = medialAxis([rect(0, 0, 40, 20)]);
    const points = all(chains);
    const deepest = Math.max(...points.map((p) => p.r));
    expect(deepest).toBeCloseTo(10, 1);
    // The ridge: y = 10 from x = 10 to x = 30, half the height from both long sides.
    const ridge = points.filter((p) => Math.abs(p.r - 10) < 0.05);
    expect(Math.min(...ridge.map((p) => p.x))).toBeCloseTo(10, 0);
    expect(Math.max(...ridge.map((p) => p.x))).toBeCloseTo(30, 0);
    ridge.forEach((p) => expect(p.y).toBeCloseTo(10, 1));
    // Diagonals reach (nearly) into all four corners.
    for (const [cx, cy] of [
      [0, 0],
      [40, 0],
      [40, 20],
      [0, 20],
    ] as const) {
      const near = Math.min(...points.map((p) => Math.hypot(p.x - cx, p.y - cy)));
      expect(near).toBeLessThan(0.3);
    }
    // Every point is as far from the outline as it says.
    for (const p of points) {
      const d = Math.min(p.x, 40 - p.x, p.y, 20 - p.y);
      expect(Math.abs(d - p.r)).toBeLessThan(0.01);
    }
  });

  it('finds the centre of a circle', () => {
    const points = all(medialAxis([circle(5, 5, 10)]).chains);
    const deepest = points.reduce((a, b) => (b.r > a.r ? b : a));
    expect(deepest.r).toBeCloseTo(10, 1);
    expect(Math.hypot(deepest.x - 5, deepest.y - 5)).toBeLessThan(0.1);
    // No noise twigs out towards the rim.
    expect(Math.min(...points.map((p) => p.r))).toBeGreaterThan(9);
  });

  it('goes round a ring between its two walls, leaving the hole', () => {
    const points = all(medialAxis([circle(0, 0, 10), circle(0, 0, 6)]).chains);
    expect(points.length).toBeGreaterThan(10);
    for (const p of points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(8, 1);
      expect(p.r).toBeCloseTo(2, 1);
    }
  });
});
