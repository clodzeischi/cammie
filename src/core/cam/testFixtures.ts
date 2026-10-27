import type { Path } from '../geometry/path';
import type {
  ChamferOperation,
  DesignObject,
  DrillOperation,
  Job,
  Operation,
  PocketOperation,
  ProfileOperation,
} from '../job/job';
import { defaultOperation } from '../job/objectFactory';
import { insertToolpath } from '../job/toolpaths';

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

/** An object plus the one cut makeJob gives it (null = not cut). */
export type TestObject = DesignObject & { operation: Operation | null };

export function makeObject(overrides: Partial<TestObject> = {}): TestObject {
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

/** A job with one toolpath (id `tp-<object id>`) per object that has an operation. */
export function makeJob(objects: TestObject[] = [makeObject()]): Job {
  return {
    stock: { width: 100, height: 50, thickness: 6 },
    origin: 'bottom-left',
    materialId: 'plywood',
    flip: 'left-right',
    objects: objects.map((o) => {
      const object: DesignObject & { operation?: unknown } = { ...o };
      delete object.operation;
      return object;
    }),
    toolpaths: objects.reduce<Job['toolpaths']>(
      (list, { id, operation }) =>
        operation ? insertToolpath(list, { id: `tp-${id}`, objectId: id, operation }) : list,
      [],
    ),
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

/** A 1 mm deep chamfer on the shape's edges with a 90° V-bit (so 1 mm wide). */
export const chamferOp = (changes: Partial<ChamferOperation> = {}): ChamferOperation => {
  const { direction, entry, finishing } = defaultOperation();
  return {
    type: 'chamfer',
    side: 'outside',
    bitId: 'vbit-90',
    depth: 1,
    direction,
    entry,
    finishing,
    ...changes,
  };
};

/** A 2 mm deep drill with a 3.175 mm end mill. */
export const drillOp = (changes: Partial<DrillOperation> = {}): DrillOperation => {
  const { direction, entry, finishing } = defaultOperation();
  return { type: 'drill', bitId: 'flat-3.175', depth: 2, direction, entry, finishing, ...changes };
};
