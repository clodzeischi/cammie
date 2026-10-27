import type { Operation, Toolpath } from './job';
import { cutKindOf, type CutKind } from './objectFactory';

/**
 * Drilling, pockets and holes first, then lines and chamfers, then parts get
 * cut free (SPEC.md §9.7).
 */
export const CUT_PRIORITY: Record<CutKind, number> = {
  drill: 1,
  pocket: 2,
  inside: 3,
  on: 4,
  chamfer: 5,
  outside: 6,
};

export const cutPriority = (op: Operation) => CUT_PRIORITY[cutKindOf(op)];

/**
 * Adds a toolpath where it naturally runs: after everything of the same or
 * earlier priority, before the first later one. A list built this way cuts in
 * the safe order (details before parts come free) without any dragging.
 */
export function insertToolpath(list: readonly Toolpath[], toolpath: Toolpath): Toolpath[] {
  const priority = cutPriority(toolpath.operation);
  const at = list.findIndex((t) => cutPriority(t.operation) > priority);
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

/** Toolpaths that share a bit, i.e. one file. */
export interface ToolpathGroup {
  bitId: string;
  toolpaths: Toolpath[];
}

/** Files in run order: bits in the order they first appear, toolpaths in list order. */
export function toolpathGroups(list: readonly Toolpath[]): ToolpathGroup[] {
  const groups = new Map<string, Toolpath[]>();
  for (const t of list) {
    const bitId = t.operation.bitId;
    groups.set(bitId, [...(groups.get(bitId) ?? []), t]);
  }
  return [...groups].map(([bitId, toolpaths]) => ({ bitId, toolpaths }));
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

/** The cuts Easy mode offers, in its order. Chamfers and drilling are Pro only. */
export const EASY_CUT_KINDS: readonly CutKind[] = ['on', 'outside', 'inside', 'pocket'];

/**
 * Easy mode handles one bit, at most one cut per object, and only its own
 * kinds of cut. Anything more is a Pro job, which Easy shows read-only rather
 * than simplifying away.
 */
export function fitsEasyMode(job: { toolpaths: readonly Toolpath[] }): boolean {
  const bits = new Set(job.toolpaths.map((t) => t.operation.bitId));
  const objects = new Set(job.toolpaths.map((t) => t.objectId));
  return (
    bits.size <= 1 &&
    objects.size === job.toolpaths.length &&
    job.toolpaths.every((t) => EASY_CUT_KINDS.includes(cutKindOf(t.operation)))
  );
}

/** The toolpaths for copied objects: same cuts, new ids, placed in natural order. */
export function copyToolpaths(
  list: readonly Toolpath[],
  copies: ReadonlyMap<string, string>,
  newId: () => string,
): Toolpath[] {
  return list
    .filter((t) => copies.has(t.objectId))
    .reduce<Toolpath[]>(
      (acc, t) => insertToolpath(acc, { ...t, id: newId(), objectId: copies.get(t.objectId)! }),
      [...list],
    );
}
