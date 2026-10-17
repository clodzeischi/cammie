import { findMaterial, presetFeeds } from '../materials/materials';
import { findBit, grooveWidth, vbitMaxDepth, type FlatBit, type VBit } from '../tools/bits';
import { anchorPoint, canvasToMachine, machineToCanvas } from './job';

const stock = { width: 200, height: 100, thickness: 6 };

describe('origin anchors', () => {
  it('places each anchor on the stock', () => {
    expect(anchorPoint(stock, 'bottom-left')).toEqual({ x: 0, y: 100 });
    expect(anchorPoint(stock, 'top-right')).toEqual({ x: 200, y: 0 });
    expect(anchorPoint(stock, 'center')).toEqual({ x: 100, y: 50 });
    expect(anchorPoint(stock, 'center-left')).toEqual({ x: 0, y: 50 });
    expect(anchorPoint(stock, 'bottom-center')).toEqual({ x: 100, y: 100 });
  });

  it('flips Y from canvas to machine and back', () => {
    const origin = anchorPoint(stock, 'bottom-left');
    // 10 mm right of the left edge, 20 mm above the bottom edge
    const machine = canvasToMachine({ x: 10, y: 80 }, origin);
    expect(machine).toEqual({ x: 10, y: 20 });
    expect(machineToCanvas(machine, origin)).toEqual({ x: 10, y: 80 });
  });
});

describe('bits', () => {
  const v60 = findBit('vbit-60') as VBit;

  it('computes V-bit groove width from depth', () => {
    // 0.2 tip + 2 × 1 mm × tan(30°)
    expect(grooveWidth(v60, 1)).toBeCloseTo(0.2 + 2 * Math.tan(Math.PI / 6));
    expect(grooveWidth(v60, 0)).toBeCloseTo(0.2);
  });

  it('caps groove width at the bit diameter', () => {
    expect(grooveWidth(v60, 100)).toBe(3.175);
    expect(vbitMaxDepth(v60)).toBeCloseTo((3.175 - 0.2) / 2 / Math.tan(Math.PI / 6));
  });
});

describe('presetFeeds', () => {
  const plywood = findMaterial('plywood')!;

  it('slows V-bits to 60% of the flat feed', () => {
    const feeds = presetFeeds(plywood, findBit('vbit-60')!);
    expect(feeds.feed).toBe(330);
    expect(feeds.plunge).toBe(plywood.base.plunge);
  });

  it('scales small flat bits down, never up', () => {
    const small: FlatBit = { id: 'f1', name: '1mm', type: 'flat', diameter: 1, flutes: 2 };
    const big: FlatBit = { ...small, id: 'f6', diameter: 6 };
    expect(presetFeeds(plywood, small).feed).toBeLessThan(plywood.base.feed);
    expect(presetFeeds(plywood, big)).toEqual(plywood.base);
  });
});
