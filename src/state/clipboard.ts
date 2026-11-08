import { DUPLICATE_OFFSET, duplicateObjects } from '../core/job/arrange';
import type { DesignObject, Toolpath } from '../core/job/job';
import { copyToolpaths } from '../core/job/toolpaths';
import { selectedObjects, useJobStore } from './jobStore';

/**
 * Cut, copy and paste of shapes with their toolpaths, within the app. The
 * clipboard holds snapshots, so pasting still works after the originals were
 * cut or changed. Each paste lands a step further down and to the right than
 * the last, so repeated pastes don't hide under each other.
 */
interface Clip {
  objects: DesignObject[];
  toolpaths: Toolpath[];
  /** Pastes made from this copy so far. */
  pastes: number;
}

let clip: Clip | null = null;
const job = () => useJobStore.getState();

/** Copies the selection; returns false when nothing is selected. */
export function copySelection(): boolean {
  const objects = selectedObjects(job());
  if (objects.length === 0) return false;
  const ids = new Set(objects.map((o) => o.id));
  clip = { objects, toolpaths: job().toolpaths.filter((t) => ids.has(t.objectId)), pastes: 0 };
  return true;
}

/** Copies the selection, then deletes it (one undo step brings it back). */
export function cutSelection(): boolean {
  if (!copySelection()) return false;
  job().removeObjects(job().selectedIds);
  return true;
}

/** Adds copies of what was copied and selects them; returns false when the clipboard is empty. */
export function paste(): boolean {
  if (!clip) return false;
  clip.pastes += 1;
  const newId = () => crypto.randomUUID();
  const ids = clip.objects.map((o) => o.id);
  const copies = duplicateObjects(clip.objects, ids, newId, DUPLICATE_OFFSET * clip.pastes);
  // duplicateObjects keeps the originals' order, so copies line up with them.
  const copyOf = new Map(clip.objects.map((o, i) => [o.id, copies[i]!.id]));
  const state = job();
  state.setObjects(
    [...state.objects, ...copies],
    copies.map((c) => c.id),
    undefined,
    copyToolpaths(state.toolpaths, copyOf, newId, clip.toolpaths),
  );
  return true;
}

/** Is there anything to paste? */
export const hasClipboard = () => clip !== null;

/** Forgets the clipboard (for tests). */
export function clearClipboard() {
  clip = null;
}
