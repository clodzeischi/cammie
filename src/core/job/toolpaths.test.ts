import { pocketOp, profileOp } from '../cam/testFixtures';
import type { Operation, Toolpath } from './job';
import {
  copyToolpaths,
  fitsEasyMode,
  insertToolpath,
  moveGroup,
  moveToolpath,
  repositionToolpath,
  toolpathGroups,
} from './toolpaths';

const tp = (id: string, operation: Operation, objectId = id): Toolpath => ({
  id,
  objectId,
  operation,
});

const engrave = profileOp({ side: 'on', bitId: 'vbit-60' });
const cutOut = profileOp({ side: 'outside', bitId: 'flat-3.175' });
const hole = profileOp({ side: 'inside', bitId: 'flat-3.175' });
const pocket = pocketOp();

const ids = (list: Toolpath[]) => list.map((t) => t.id);

describe('insertToolpath', () => {
  it('places pockets and holes before lines, and cut-outs last', () => {
    const list = [
      tp('out', cutOut),
      tp('line', engrave),
      tp('hole', hole),
      tp('pocket', pocket),
    ].reduce<Toolpath[]>(insertToolpath, []);
    expect(ids(list)).toEqual(['pocket', 'hole', 'line', 'out']);
  });

  it('keeps the order things were added for cuts of the same kind', () => {
    const list = [tp('a', engrave), tp('b', engrave)].reduce<Toolpath[]>(insertToolpath, []);
    expect(ids(list)).toEqual(['a', 'b']);
  });

  it('moves a toolpath to its new place when its cut type changes', () => {
    const list = [tp('line', engrave), tp('out', cutOut)];
    const changed = list.map((t) => (t.id === 'line' ? { ...t, operation: pocket } : t));
    expect(ids(repositionToolpath(changed, 'line'))).toEqual(['line', 'out']);
    const later = list.map((t) => (t.id === 'line' ? { ...t, operation: cutOut } : t));
    expect(ids(repositionToolpath(later, 'line'))).toEqual(['out', 'line']);
  });
});

describe('toolpathGroups', () => {
  it('makes one file per bit, in the order bits first appear', () => {
    const groups = toolpathGroups([tp('a', hole), tp('b', engrave), tp('c', cutOut)]);
    expect(groups.map((g) => g.bitId)).toEqual(['flat-3.175', 'vbit-60']);
    expect(ids(groups[0]!.toolpaths)).toEqual(['a', 'c']);
  });
});

describe('moving toolpaths', () => {
  const list = [tp('a', hole), tp('b', engrave), tp('c', cutOut)];

  it('swaps a toolpath with its neighbour in the same file', () => {
    expect(ids(moveToolpath(list, 'c', -1))).toEqual(['c', 'a', 'b']);
    expect(ids(moveToolpath(list, 'a', -1))).toEqual(['a', 'c', 'b']);
  });

  it('moves a whole file earlier or later', () => {
    expect(ids(moveGroup(list, 'vbit-60', -1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveGroup(list, 'vbit-60', 1))).toEqual(['a', 'c', 'b']);
  });
});

describe('fitsEasyMode', () => {
  it('allows one bit and one cut per object', () => {
    expect(fitsEasyMode({ toolpaths: [] })).toBe(true);
    expect(fitsEasyMode({ toolpaths: [tp('a', engrave), tp('b', engrave)] })).toBe(true);
  });

  it('rejects a second bit or a second cut on the same object', () => {
    expect(fitsEasyMode({ toolpaths: [tp('a', engrave), tp('b', cutOut)] })).toBe(false);
    expect(fitsEasyMode({ toolpaths: [tp('a', hole, 'x'), tp('b', cutOut, 'x')] })).toBe(false);
  });
});

describe('copyToolpaths', () => {
  it('gives copied objects the same cuts, in natural order', () => {
    const list = [tp('line', engrave, 'x'), tp('out', cutOut, 'y')];
    let n = 0;
    const result = copyToolpaths(list, new Map([['x', 'x2']]), () => `new${++n}`);
    expect(result.map((t) => `${t.id}:${t.objectId}`)).toEqual(['line:x', 'new1:x2', 'out:y']);
  });
});
