import type { Operation, Toolpath } from './job';
import { cutKindOf, type CutKind } from './objectFactory';

/**
 * Drilling, V-carving, pockets and holes first, then lines and chamfers, then
 * parts get cut free (SPEC.md §9.7).
 */
export const CUT_PRIORITY: Record<CutKind, number> = {
  drill: 1,
  vcarve: 2,
  pocket: 3,
  inside: 4,
  on: 5,
  chamfer: 6,
  outside: 7,
};

export const cutPriority = (op: Operation) => CUT_PRIORITY[cutKindOf(op)];

/**
 * Adds a toolpath where it naturally runs: after everything of the same or
 * earlier priority, before the first later one. A list
 * built this way cuts in the safe order (details before parts come free)
 * without any dragging.
 */
export function insertToolpath(list: readonly Toolpath[], toolpath: Toolpath): Toolpath[] {
  const rank = cutPriority(toolpath.operation);
  const at = list.findIndex((t) => cutPriority(t.operation) > rank);
  return at < 0 ? [...list, toolpath] : [...list.slice(0, at), toolpath, ...list.slice(at)];
}

/** Takes a toolpath out and puts it back at its natural place (after its cut type changed). */
export function repositionToolpath(list: readonly Toolpath[], id: string): Toolpath[] {
  const toolpath = list.find((t) => t.id === id);
  if (!toolpath) return [...list];
  return insertToolpath(
    list.filter((t) => t.id !== id),
    toolpath,
  );
}

/**
 * Splits items into files, one per bit; items keep list order within a file. Files run in the order of
 * each bit's last item, so the file holding the final cut-outs runs last and
 * a chamfer or engraving on another bit isn't left until after parts are cut
 * free. A list the user has reordered is contiguous per file, so this keeps
 * their order. Shared by the toolpath list and the CAM so they agree.
 */
export function groupIntoFiles<T>(
  items: readonly T[],
  bitOf: (item: T) => string,
): Array<{ bitId: string; items: T[] }> {
  const groups = new Map<string, { bitId: string; items: T[]; last: number }>();
  items.forEach((item, i) => {
    const bitId = bitOf(item);
    const group = groups.get(bitId) ?? { bitId, items: [], last: i };
    group.items.push(item);
    group.last = i;
    groups.set(bitId, group);
  });
  return [...groups.values()]
    .sort((a, b) => a.last - b.last)
    .map(({ bitId, items }) => ({ bitId, items }));
}

/** Toolpaths that share a bit, i.e. one file. */
export interface ToolpathGroup {
  bitId: string;
  toolpaths: Toolpath[];
}

/** Files in run order (see groupIntoFiles). */
export function toolpathGroups(list: readonly Toolpath[]): ToolpathGroup[] {
  return groupIntoFiles(list, (t) => t.operation.bitId).map(({ bitId, items }) => ({
    bitId,
    toolpaths: items,
  }));
}

const flatten = (groups: readonly ToolpathGroup[]) => groups.flatMap((g) => g.toolpaths);

/** Moves a toolpath one step earlier (-1) or later (+1) within its file. */
export function moveToolpath(list: readonly Toolpath[], id: string, delta: -1 | 1): Toolpath[] {
  const groups = toolpathGroups(list);
  const group = groups.find((g) => g.toolpaths.some((t) => t.id === id));
  if (!group) return [...list];
  const from = group.toolpaths.findIndex((t) => t.id === id);
  const to = from + delta;
  if (to < 0 || to >= group.toolpaths.length) return flatten(groups);
  const toolpaths = [...group.toolpaths];
  [toolpaths[from], toolpaths[to]] = [toolpaths[to]!, toolpaths[from]!];
  return flatten(groups.map((g) => (g === group ? { ...g, toolpaths } : g)));
}

/** Moves a whole file (every toolpath with that bit) one step earlier or later. */
export function moveGroup(list: readonly Toolpath[], bitId: string, delta: -1 | 1): Toolpath[] {
  const groups = toolpathGroups(list);
  const from = groups.findIndex((g) => g.bitId === bitId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= groups.length) return flatten(groups);
  [groups[from], groups[to]] = [groups[to]!, groups[from]!];
  return flatten(groups);
}

export const toolpathsOf = (list: readonly Toolpath[], objectId: string) =>
  list.filter((t) => t.objectId === objectId);

/**
 * `list` plus the toolpaths for copied objects: same cuts, new ids, placed in
 * natural order. The cuts are taken from `source` (by default `list` itself;
 * a paste brings its own, as the originals may have been deleted since).
 */
export function copyToolpaths(
  list: readonly Toolpath[],
  copies: ReadonlyMap<string, string>,
  newId: () => string,
  source: readonly Toolpath[] = list,
): Toolpath[] {
  return source
    .filter((t) => copies.has(t.objectId))
    .reduce<Toolpath[]>(
      (acc, t) => insertToolpath(acc, { ...t, id: newId(), objectId: copies.get(t.objectId)! }),
      [...list],
    );
}
