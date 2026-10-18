import { EMPTY_BOUNDS, unionBounds, type Bounds, type Vec2 } from '../geometry/path';
import type { DesignObject, Stock } from './job';
import { objectBounds } from './placement';

/** Align edges and centres (SPEC.md §5.1 Arrange). */
export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Ids that move together: a group counts as one unit. */
export const unitKey = (object: DesignObject) => object.groupId ?? object.id;

/** The ids of `id`'s whole group (or just `id` when it isn't grouped). */
export function withGroupMates(objects: readonly DesignObject[], ids: readonly string[]): string[] {
  const keys = new Set(objects.filter((o) => ids.includes(o.id)).map(unitKey));
  return objects.filter((o) => keys.has(unitKey(o))).map((o) => o.id);
}

export function selectionBounds(objects: readonly DesignObject[]): Bounds {
  return objects.reduce((b, o) => unionBounds(b, objectBounds(o)), EMPTY_BOUNDS);
}

const stockBounds = (stock: Stock): Bounds => ({
  minX: 0,
  minY: 0,
  maxX: stock.width,
  maxY: stock.height,
});

/** The object without its group id. */
function ungrouped(object: DesignObject): DesignObject {
  const copy = { ...object };
  delete copy.groupId;
  return copy;
}

const moveBy = (object: DesignObject, d: Vec2): DesignObject => ({
  ...object,
  transform: { ...object.transform, x: object.transform.x + d.x, y: object.transform.y + d.y },
});

/** How far a box must move so its `alignment` edge/centre lines up with the target's. */
function alignOffset(box: Bounds, target: Bounds, alignment: Alignment): Vec2 {
  const centre = (lo: number, hi: number) => (lo + hi) / 2;
  switch (alignment) {
    case 'left':
      return { x: target.minX - box.minX, y: 0 };
    case 'right':
      return { x: target.maxX - box.maxX, y: 0 };
    case 'center':
      return { x: centre(target.minX, target.maxX) - centre(box.minX, box.maxX), y: 0 };
    case 'top':
      return { x: 0, y: target.minY - box.minY };
    case 'bottom':
      return { x: 0, y: target.maxY - box.maxY };
    case 'middle':
      return { x: 0, y: centre(target.minY, target.maxY) - centre(box.minY, box.maxY) };
  }
}

/**
 * Lines up the selected objects. Several units (objects or groups) align to
 * each other's combined box; a single unit aligns to the stock, which is how
 * you centre a sign's text on the board.
 */
export function alignObjects(
  objects: readonly DesignObject[],
  ids: readonly string[],
  alignment: Alignment,
  stock: Stock,
): DesignObject[] {
  const selected = objects.filter((o) => ids.includes(o.id));
  const units = new Map<string, DesignObject[]>();
  for (const o of selected) units.set(unitKey(o), [...(units.get(unitKey(o)) ?? []), o]);
  const target = units.size > 1 ? selectionBounds(selected) : stockBounds(stock);

  const offsets = new Map<string, Vec2>();
  for (const [key, members] of units) {
    offsets.set(key, alignOffset(selectionBounds(members), target, alignment));
  }
  return objects.map((o) => {
    const d = ids.includes(o.id) ? offsets.get(unitKey(o)) : undefined;
    return d ? moveBy(o, d) : o;
  });
}

/** Moves the selection as a whole so it sits in the middle of the stock. */
export function centerOnStock(
  objects: readonly DesignObject[],
  ids: readonly string[],
  stock: Stock,
): DesignObject[] {
  const box = selectionBounds(objects.filter((o) => ids.includes(o.id)));
  const d = {
    x: alignOffset(box, stockBounds(stock), 'center').x,
    y: alignOffset(box, stockBounds(stock), 'middle').y,
  };
  return objects.map((o) => (ids.includes(o.id) ? moveBy(o, d) : o));
}

export function nudgeObjects(
  objects: readonly DesignObject[],
  ids: readonly string[],
  d: Vec2,
): DesignObject[] {
  return objects.map((o) => (ids.includes(o.id) ? moveBy(o, d) : o));
}

/** Copies land this far (mm) down and to the right of the originals. */
export const DUPLICATE_OFFSET = 5;

/**
 * Copies of the selected objects, offset so they're visible. Copied groups
 * become new groups, so the copy and the original move independently.
 */
export function duplicateObjects(
  objects: readonly DesignObject[],
  ids: readonly string[],
  newId: () => string,
): DesignObject[] {
  const groupIds = new Map<string, string>();
  return objects
    .filter((o) => ids.includes(o.id))
    .map((o) => {
      const { groupId } = o;
      if (groupId && !groupIds.has(groupId)) groupIds.set(groupId, newId());
      return {
        ...ungrouped(moveBy(o, { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET })),
        id: newId(),
        name: `${o.name} copy`,
        ...(groupId && { groupId: groupIds.get(groupId)! }),
      };
    });
}

/** Puts the objects in one new group (or takes them out of their groups). */
export function setGroup(
  objects: readonly DesignObject[],
  ids: readonly string[],
  groupId: string | null,
): DesignObject[] {
  return objects.map((o) => {
    if (!ids.includes(o.id)) return o;
    return groupId ? { ...o, groupId } : ungrouped(o);
  });
}
