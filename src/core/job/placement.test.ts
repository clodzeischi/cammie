import { makeObject } from '../cam/testFixtures';
import { anchorPoint } from './job';
import {
  machinePosition,
  objectBounds,
  objectSize,
  withMachinePosition,
  withRotation,
  withSize,
} from './placement';

// Stock 100 × 50, origin bottom-left → canvas (0, 50).
const origin = anchorPoint({ width: 100, height: 50, thickness: 6 }, 'bottom-left');
// A 10 × 10 object with its top-left at canvas (10, 10): lower-left is machine (10, 30).
const object = makeObject();

describe('placement', () => {
  it('reports the lower-left corner in machine coordinates', () => {
    expect(machinePosition(object, origin)).toEqual({ x: 10, y: 30 });
  });

  it('moves the object to a typed position', () => {
    const transform = withMachinePosition(object, origin, { x: 0, y: 0 });
    expect(machinePosition({ ...object, transform }, origin)).toEqual({ x: 0, y: 0 });
  });

  it('resizes with locked aspect, keeping the lower-left corner', () => {
    const transform = withSize(object, { width: 20 }, true);
    const resized = { ...object, transform };
    expect(objectSize(resized)).toEqual({ width: 20, height: 20 });
    expect(machinePosition(resized, origin)).toEqual({ x: 10, y: 30 });
  });

  it('resizes one side when aspect is unlocked', () => {
    const transform = withSize(object, { height: 5 }, false);
    expect(objectSize({ ...object, transform })).toEqual({ width: 10, height: 5 });
  });

  it('rotates in place about a centre pivot', () => {
    const centred = { ...object, pivot: 'center' as const };
    const transform = withRotation(centred, 90);
    const b = objectBounds({ ...centred, transform });
    expect((b.minX + b.maxX) / 2).toBeCloseTo(15);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(15);
  });

  describe('with a chosen pivot', () => {
    // Stretched to 20 × 10 so rotating changes the box.
    const wide = { ...object, transform: { ...object.transform, scaleX: 2 } };

    it('reports the pivot instead of the lower-left corner', () => {
      // Box spans canvas x 10–30, y 10–20 → machine x 10–30, y 30–40.
      expect(machinePosition({ ...wide, pivot: 'center' }, origin)).toEqual({ x: 20, y: 35 });
      expect(machinePosition({ ...wide, pivot: 'top-right' }, origin)).toEqual({ x: 30, y: 40 });
    });

    it('moves the pivot onto a typed position', () => {
      const pivoted = { ...wide, pivot: 'center' as const };
      const transform = withMachinePosition(pivoted, origin, { x: 0, y: 0 });
      const b = objectBounds({ ...pivoted, transform });
      expect(b.minX + b.maxX).toBeCloseTo(0);
      expect(b.minY + b.maxY).toBeCloseTo(2 * origin.y);
    });

    it.each(['bottom-left', 'top-right', 'center-left'] as const)(
      'keeps the %s pivot in place when resized or rotated',
      (pivot) => {
        const pivoted = { ...wide, pivot };
        const before = machinePosition(pivoted, origin);
        const resized = { ...pivoted, transform: withSize(pivoted, { width: 50 }, true) };
        const rotated = { ...pivoted, transform: withRotation(pivoted, 30) };
        for (const changed of [resized, rotated]) {
          const after = machinePosition(changed, origin);
          expect(after.x).toBeCloseTo(before.x);
          expect(after.y).toBeCloseTo(before.y);
        }
      },
    );
  });
});
