import type { Path } from '../geometry/path';
import type { DesignObject, Job, PocketOperation, ProfileOperation } from '../job/job';
import { defaultOperation } from '../job/objectFactory';

/** Shared test data for CAM and post-processor tests. */

export const square = (x: number, y: number, size = 10): Path => ({
  closed: true,
  points: [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ],
});

export function makeObject(overrides: Partial<DesignObject> = {}): DesignObject {
  return {
    id: 'obj-1',
    name: 'Logo',
    kind: 'traced-image',
    paths: [square(0, 0)],
    width: 10,
    height: 10,
    transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
    operation: profileOp({ depth: 1 }),
    ...overrides,
  };
}

export function makeJob(objects: DesignObject[] = [makeObject()]): Job {
  return {
    stock: { width: 100, height: 50, thickness: 6 },
    origin: 'bottom-left',
    materialId: 'plywood',
    objects,
  };
}

/** A profile operation: defaults (V-bit on the line, climb, ramp) plus changes. */
export const profileOp = (changes: Partial<ProfileOperation> = {}): ProfileOperation => ({
  ...defaultOperation(),
  ...changes,
});

/** A pocket with a 3.175 mm end mill unless told otherwise. */
export const pocketOp = (changes: Partial<PocketOperation> = {}): PocketOperation => {
  const { direction, entry, finishing } = defaultOperation();
  return { type: 'pocket', bitId: 'flat-3.175', depth: 3, direction, entry, finishing, ...changes };
};
