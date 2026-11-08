import { beforeEach, describe, expect, it } from 'vitest';
import { profileOp, square } from '../core/cam/testFixtures';
import type { DesignObject } from '../core/job/job';
import { clearClipboard, copySelection, cutSelection, paste } from './clipboard';
import { useJobStore } from './jobStore';

const shape: DesignObject = {
  id: 'a',
  name: 'Owl',
  kind: 'svg',
  paths: [square(0, 0)],
  width: 10,
  height: 10,
  transform: { x: 10, y: 10, rotation: 0, scaleX: 1, scaleY: 1 },
};

describe('clipboard', () => {
  beforeEach(() => {
    clearClipboard();
    useJobStore.getState().clearDesign();
    useJobStore.getState().addObject(shape, profileOp({ depth: 1 }));
  });

  it('pastes copies with their cuts, each a step further from the original', () => {
    expect(copySelection()).toBe(true);
    paste();
    paste();
    const { objects, toolpaths, selectedIds } = useJobStore.getState();
    expect(objects.map((o) => o.transform.x)).toEqual([10, 15, 20]);
    expect(objects.map((o) => o.transform.y)).toEqual([10, 15, 20]);
    expect(new Set(objects.map((o) => o.id)).size).toBe(3);
    expect(toolpaths.map((t) => t.objectId)).toEqual(objects.map((o) => o.id));
    expect(selectedIds).toEqual([objects[2]!.id]);
  });

  it('cut removes the shape; paste brings back a copy with its cut', () => {
    expect(cutSelection()).toBe(true);
    expect(useJobStore.getState().objects).toEqual([]);
    expect(useJobStore.getState().toolpaths).toEqual([]);
    paste();
    const { objects, toolpaths } = useJobStore.getState();
    expect(objects).toHaveLength(1);
    expect(toolpaths).toHaveLength(1);
    expect(toolpaths[0]!.operation).toEqual(profileOp({ depth: 1 }));
  });

  it('does nothing without a selection or a copy', () => {
    useJobStore.getState().select(null);
    expect(copySelection()).toBe(false);
    expect(cutSelection()).toBe(false);
    expect(paste()).toBe(false);
  });
});
