import { gridLines, GRID_SPACINGS, majorEvery, snapBoxOffset, snapPoint } from './grid';

describe('grid', () => {
  it('picks round major lines for every offered spacing', () => {
    expect(GRID_SPACINGS.map((s) => s * majorEvery(s))).toEqual([5, 5, 10, 25, 50, 100, 250, 250]);
  });

  it('places lines through the work origin', () => {
    // Origin at the stock centre (100, 75) with a 10 mm grid on a 200 × 150 board.
    const ys = gridLines(0, 150, 75, 10);
    expect(ys[0]).toEqual({ at: 5, major: false });
    expect(ys.find((l) => l.at === 75)).toEqual({ at: 75, major: true });
    expect(ys.find((l) => l.at === 25)?.major).toBe(true);
    expect(ys.at(-1)!.at).toBe(145);
  });

  it('snaps points to the nearest line', () => {
    expect(snapPoint({ x: 12.4, y: 17.6 }, { x: 0, y: 150 }, 5)).toEqual({ x: 10, y: 20 });
    expect(snapPoint({ x: 0.74, y: 0.26 }, { x: 0, y: 0 }, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('moves a box the least distance that puts one of its edges on the grid', () => {
    // x: left edge 1 mm from a line, right edge 4 mm → snap left.
    // y: top edge 3 mm from a line, bottom edge 2 mm → snap bottom.
    expect(snapBoxOffset({ minX: 11, maxX: 34, minY: 3, maxY: 18 }, { x: 0, y: 0 }, 10)).toEqual({
      x: -1,
      y: 2,
    });
    // Left edge 1.5 mm from a line, right edge 0.8 mm → snap right.
    expect(
      snapBoxOffset({ minX: 8.5, maxX: 39.2, minY: 0, maxY: 0 }, { x: 0, y: 0 }, 10).x,
    ).toBeCloseTo(0.8);
  });
});
