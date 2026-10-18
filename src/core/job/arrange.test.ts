import { makeObject, square } from '../cam/testFixtures';
import {
  alignObjects,
  centerOnStock,
  duplicateObjects,
  selectionBounds,
  setGroup,
  withGroupMates,
} from './arrange';
import { objectBounds } from './placement';

const stock = { width: 100, height: 50, thickness: 6 };
const at = (id: string, x: number, y: number, size = 10) =>
  makeObject({
    id,
    paths: [square(0, 0, size)],
    width: size,
    height: size,
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
  });

describe('arrange', () => {
  const objects = [at('a', 10, 5), at('b', 40, 20, 20), at('c', 70, 30)];

  it('aligns several objects to their combined box', () => {
    const left = alignObjects(objects, ['a', 'b'], 'left', stock);
    expect(left.map((o) => o.transform.x)).toEqual([10, 10, 70]);
    const bottom = alignObjects(objects, ['a', 'b'], 'bottom', stock);
    expect(bottom.map((o) => objectBounds(o).maxY)).toEqual([40, 40, 40]);
    const centre = alignObjects(objects, ['a', 'b'], 'center', stock);
    // Combined box x 10..60 → centre 35.
    expect(
      centre.slice(0, 2).map((o) => (objectBounds(o).minX + objectBounds(o).maxX) / 2),
    ).toEqual([35, 35]);
  });

  it('aligns a single object to the stock', () => {
    const [a] = alignObjects(objects, ['a'], 'right', stock);
    expect(objectBounds(a!).maxX).toBe(100);
    const [, b] = alignObjects(objects, ['b'], 'middle', stock);
    expect(objectBounds(b!).minY).toBe(15);
  });

  it('moves a group as one unit', () => {
    const grouped = setGroup(objects, ['a', 'b'], 'g1');
    expect(withGroupMates(grouped, ['a'])).toEqual(['a', 'b']);
    // One unit selected → aligns to the stock; the pair keeps its spacing.
    const right = alignObjects(grouped, ['a', 'b'], 'right', stock);
    expect(right.map((o) => o.transform.x)).toEqual([50, 80, 70]);
    expect(setGroup(grouped, ['a', 'b'], null).some((o) => 'groupId' in o)).toBe(false);
  });

  it('centres the selection on the stock', () => {
    const moved = centerOnStock(objects, ['a', 'b'], stock);
    const b = selectionBounds(moved.slice(0, 2));
    expect([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2]).toEqual([50, 25]);
  });

  it('duplicates with new ids, an offset and new groups', () => {
    let n = 0;
    const grouped = setGroup(objects, ['a', 'b'], 'g1');
    const copies = duplicateObjects(grouped, ['a', 'b'], () => `new-${++n}`);
    expect(copies.map((o) => o.transform.x)).toEqual([15, 45]);
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
    expect(copies[0]!.groupId).not.toBe('g1');
    expect(new Set(copies.map((o) => o.id)).size).toBe(2);
    expect(copies[0]!.name).toBe('Logo copy');
  });
});
