import {
  alignObjects,
  centerOnStock,
  duplicateObjects,
  nudgeObjects,
  setGroup,
  unitKey,
  type Alignment,
} from '../core/job/arrange';
import { copyToolpaths } from '../core/job/toolpaths';
import type { Vec2 } from '../core/geometry/path';
import { selectedObjects, useJobStore } from './jobStore';

/**
 * Arrange commands on the current selection, shared by the side panel and
 * keyboard shortcuts. Each is one undo step (nudges in a row merge into one).
 */
const state = () => useJobStore.getState();
const ids = () => state().selectedIds;

export const arrange = {
  align: (alignment: Alignment) =>
    state().setObjects(alignObjects(state().objects, ids(), alignment, state().stock)),
  centerOnStock: () => state().setObjects(centerOnStock(state().objects, ids(), state().stock)),
  nudge: (d: Vec2) =>
    state().setObjects(nudgeObjects(state().objects, ids(), d), undefined, 'nudge'),
  duplicate: () => {
    if (ids().length === 0) return;
    const originals = state().objects.filter((o) => ids().includes(o.id));
    const copies = duplicateObjects(state().objects, ids(), () => crypto.randomUUID());
    // duplicateObjects keeps the originals' order, so copies line up with them.
    const copyOf = new Map(originals.map((o, i) => [o.id, copies[i]!.id]));
    state().setObjects(
      [...state().objects, ...copies],
      copies.map((c) => c.id),
      undefined,
      copyToolpaths(state().toolpaths, copyOf, () => crypto.randomUUID()),
    );
  },
  group: () => {
    if (!canGroup()) return;
    state().setObjects(setGroup(state().objects, ids(), crypto.randomUUID()));
  },
  ungroup: () => {
    if (!canUngroup()) return;
    state().setObjects(setGroup(state().objects, ids(), null));
  },
  remove: () => state().removeObjects(ids()),
};

/** Grouping needs two or more separate things selected. */
export const canGroup = (s = state()) => new Set(selectedObjects(s).map(unitKey)).size > 1;
export const canUngroup = (s = state()) => selectedObjects(s).some((o) => o.groupId);
