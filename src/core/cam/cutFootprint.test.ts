import { describe, expect, it } from 'vitest';
import { boundsOfPaths } from '../geometry/path';
import { findBit, type Bit } from '../tools/bits';
import { cutFootprint } from './cutFootprint';
import { chamferOp, drillOp, pocketOp, profileOp, square } from './testFixtures';

const flat = findBit('flat-3.175')!;
const vbit90 = findBit('vbit-90')!;
const r = flat.diameter / 2;
const shape = [square(0, 0, 20)];

const bandBounds = (bit: Bit, op: Parameters<typeof cutFootprint>[1], scale = 1) => {
  const { bands } = cutFootprint(shape, op, bit, scale);
  return { box: boundsOfPaths(bands.map((b) => b.path)), width: bands[0]!.width };
};

describe('cut footprints', () => {
  it('centres an engraved groove on the line', () => {
    const { box, width } = bandBounds(flat, profileOp({ side: 'on', depth: 1 }));
    expect(box).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
    expect(width).toBeCloseTo(flat.diameter);
  });

  it('puts a cut-out just outside the line and a hole just inside it', () => {
    const outside = bandBounds(flat, profileOp({ side: 'outside', depth: 6 })).box;
    expect(outside.minX).toBeCloseTo(-r, 2);
    expect(outside.maxX).toBeCloseTo(20 + r, 2);
    const inside = bandBounds(flat, profileOp({ side: 'inside', depth: 6 })).box;
    expect(inside.minX).toBeCloseTo(r, 2);
    expect(inside.maxX).toBeCloseTo(20 - r, 2);
  });

  it('fills a pocket, leaving islands clear', () => {
    const island = square(5, 5, 10);
    const { area, bands } = cutFootprint([square(0, 0, 20), island], pocketOp(), flat);
    expect(area).toHaveLength(2);
    expect(bands).toEqual([]);
  });

  it('bevels a part inward by the chamfer width', () => {
    // A 90° V-bit 1 mm deep reaches 1 mm in from the edge.
    const { box, width } = bandBounds(vbit90, chamferOp({ side: 'outside', depth: 1 }));
    expect(width).toBeCloseTo(1);
    expect(box.minX).toBeCloseTo(0.5, 2);
  });

  it('marks a bit-sized hole at the centre for drilling', () => {
    expect(cutFootprint(shape, drillOp(), flat).holes).toEqual([
      { centre: { x: 10, y: 10 }, diameter: flat.diameter },
    ]);
  });

  it('divides sizes by the object scale, so they come out right once drawn scaled', () => {
    const { box, width } = bandBounds(flat, profileOp({ side: 'outside', depth: 6 }), 2);
    expect(width).toBeCloseTo(flat.diameter / 2);
    expect(box.minX).toBeCloseTo(-r / 2, 2);
  });
});
