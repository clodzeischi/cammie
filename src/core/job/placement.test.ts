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
    const transform = withSize(object, origin, { width: 20 }, true);
    const resized = { ...object, transform };
    expect(objectSize(resized)).toEqual({ width: 20, height: 20 });
    expect(machinePosition(resized, origin)).toEqual({ x: 10, y: 30 });
  });

  it('resizes one side when aspect is unlocked', () => {
    const transform = withSize(object, origin, { height: 5 }, false);
    expect(objectSize({ ...object, transform })).toEqual({ width: 10, height: 5 });
  });

  it('rotates about the centre', () => {
    const transform = withRotation(object, 90);
    const b = objectBounds({ ...object, transform });
    expect((b.minX + b.maxX) / 2).toBeCloseTo(15);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(15);
  });
});
