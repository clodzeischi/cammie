import type { ObjectTabs } from '../cam/program';
import { Loop } from '../cam/toolpath/loop';
import { distance, type Vec2 } from '../geometry/path';
import { applyMatrix, invertMatrix, toMatrix } from '../geometry/transform';
import type { DesignObject } from './job';

export interface TabEdit {
  objectId: string;
  /** The object's new hand-placed tabs, in its own coordinates. */
  manual: Vec2[];
}

/** The existing tab nearest to `point`, if any is within `tolerance`. */
function nearestTab(point: Vec2, tabs: readonly ObjectTabs[], tolerance: number) {
  let found: { tabs: ObjectTabs; index: number } | null = null;
  let best = tolerance;
  for (const t of tabs) {
    for (let index = 0; index < t.centres.length; index++) {
      const d = distance(point, t.centres[index]!);
      if (d <= best) {
        best = d;
        found = { tabs: t, index };
      }
    }
  }
  return found;
}

/** The nearest point on any tabbable loop, if one is within `tolerance`. */
function nearestLoopPoint(point: Vec2, tabs: readonly ObjectTabs[], tolerance: number) {
  let found: { tabs: ObjectTabs; at: Vec2 } | null = null;
  let best = tolerance;
  for (const t of tabs) {
    for (const path of t.loops) {
      const loop = new Loop(path);
      const c = loop.closest(point);
      if (c.distance <= best) {
        best = c.distance;
        found = { tabs: t, at: loop.pointAt(c.s) };
      }
    }
  }
  return found;
}

/**
 * What a click at `point` (canvas mm) does to the tabs: removes a tab within
 * `tolerance` of it, otherwise adds one on the nearest tabbable loop within
 * `tolerance`. Returns null when the click is near nothing. The current tabs
 * (automatic or not) become the hand-placed set, so the first edit keeps the rest.
 */
export function editTabsAt(
  point: Vec2,
  tabs: readonly ObjectTabs[],
  objects: readonly DesignObject[],
  tolerance: number,
): TabEdit | null {
  let edited: { objectId: string; centres: Vec2[] };
  const hit = nearestTab(point, tabs, tolerance);
  if (hit) {
    edited = {
      objectId: hit.tabs.objectId,
      centres: hit.tabs.centres.filter((_, i) => i !== hit.index),
    };
  } else {
    const spot = nearestLoopPoint(point, tabs, tolerance);
    if (!spot) return null;
    edited = { objectId: spot.tabs.objectId, centres: [...spot.tabs.centres, spot.at] };
  }

  const object = objects.find((o) => o.id === edited.objectId);
  if (!object) return null;
  const toLocal = invertMatrix(toMatrix(object.transform));
  return { objectId: object.id, manual: edited.centres.map((c) => applyMatrix(toLocal, c)) };
}
