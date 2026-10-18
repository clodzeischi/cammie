import { makeObject, square } from '../cam/testFixtures';
import { applyMatrix, invertMatrix, toMatrix } from '../geometry/transform';
import { editTabsAt } from './tabEditing';

// Object moved to (10, 10) and doubled in size; its loop in canvas space is 0..40 around (10,10).
const object = makeObject({ transform: { x: 10, y: 10, rotation: 30, scaleX: 2, scaleY: 2 } });
const tabs = [{ objectId: object.id, loops: [square(10, 10, 40)], centres: [{ x: 30, y: 10 }] }];

describe('invertMatrix', () => {
  it('undoes the transform', () => {
    const m = toMatrix(object.transform);
    const p = applyMatrix(invertMatrix(m), applyMatrix(m, { x: 3, y: -7 }));
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(-7);
  });
});

describe('editTabsAt', () => {
  const toCanvas = (p: { x: number; y: number }) => applyMatrix(toMatrix(object.transform), p);

  it('removes the tab under the click', () => {
    const edit = editTabsAt({ x: 31, y: 10.5 }, tabs, [object], 2);
    expect(edit).toEqual({ objectId: object.id, manual: [] });
  });

  it('adds a tab on the nearest loop, stored in object space', () => {
    const edit = editTabsAt({ x: 51, y: 30 }, tabs, [object], 2)!;
    expect(edit.manual).toHaveLength(2);
    const added = toCanvas(edit.manual[1]!);
    expect(added.x).toBeCloseTo(50);
    expect(added.y).toBeCloseTo(30);
    const kept = toCanvas(edit.manual[0]!);
    expect(kept.x).toBeCloseTo(30);
  });

  it('ignores clicks away from any loop', () => {
    expect(editTabsAt({ x: 30, y: 30 }, tabs, [object], 2)).toBeNull();
  });
});
