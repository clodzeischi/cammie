import { offsetRegion, sweepPaths, uncoveredArea } from '../clipper/clipper';
import { boundsOfPaths, boundsOfPoints, type Bounds, type Path, type Vec2 } from '../geometry/path';
import type { CutPlan, ObjectCut } from './cutPlan';
import type { CutLoopsParams } from './toolpath/cutLoops';
import type { DrillParams } from './toolpath/drill';

/**
 * Stacked cuts (SPEC.md §9.12): a cut lying inside material an earlier cut
 * already removed starts on that floor instead of at the top of the stock,
 * e.g. a screw's through hole inside its counterbore.
 */

/** A swept area must be inside a cleared one to within this (mm), to absorb rounding. */
const SLACK = 0.01;
/** Uncovered area (mm²) that still counts as covered. */
const AREA_SLACK = 1e-4;
const EPS = 1e-6;

/** Something to cut as one piece: a loop, a drilled hole or a whole pocket. */
interface Unit {
  bounds: Bounds;
  /** The area the tool sweeps; only worked out when an earlier cut might contain it. */
  sweep: () => Path[];
}

interface ClearedArea {
  bounds: Bounds;
  region: () => Path[];
  depth: number;
  /** Position of the clearing cut in run order. */
  order: number;
  label: string;
}

const lazy = <T>(make: () => T): (() => T) => {
  let value: T | undefined;
  return () => (value ??= make());
};

const contains = (outer: Bounds, inner: Bounds) =>
  inner.minX >= outer.minX - SLACK &&
  inner.minY >= outer.minY - SLACK &&
  inner.maxX <= outer.maxX + SLACK &&
  inner.maxY <= outer.maxY + SLACK;

const grow = (b: Bounds, by: number): Bounds => ({
  minX: b.minX - by,
  minY: b.minY - by,
  maxX: b.maxX + by,
  maxY: b.maxY + by,
});

/** What cuts remove: areas cut flat down to a depth, by the cut that did it. */
class ClearedMaterial {
  private readonly areas: ClearedArea[] = [];

  add(area: ClearedArea): void {
    if (area.depth > EPS) this.areas.push(area);
  }

  /**
   * The deepest floor cleared under the whole unit by cuts that `counts`
   * (0 = untouched stock), and the cut that cleared it.
   */
  floorUnder(unit: Unit, counts: (a: ClearedArea) => boolean): { depth: number; by?: string } {
    const candidates = this.areas.filter((a) => counts(a) && contains(a.bounds, unit.bounds));
    if (candidates.length === 0) return { depth: 0 };
    const test = offsetRegion(unit.sweep(), -SLACK);
    if (test.length === 0) return { depth: 0 };
    const depths = [...new Set(candidates.map((a) => a.depth))].sort((a, b) => b - a);
    for (const depth of depths) {
      // Several cuts can share the job, e.g. two pockets side by side.
      const cover = candidates.filter((a) => a.depth >= depth - EPS);
      if (
        uncoveredArea(
          test,
          cover.flatMap((a) => a.region()),
        ) <= AREA_SLACK
      ) {
        return { depth, by: cover.find((a) => a.depth === depth)?.label };
      }
    }
    return { depth: 0 };
  }
}

export interface ClearedFloorsResult {
  files: ObjectCut[][];
  /** Cuts that run before the cut clearing their top, so they still start at the top. */
  notes: Array<{ cut: ObjectCut; message: string }>;
}

const fmt = (mm: number) => `${Math.round(mm * 100) / 100} mm`;

/**
 * Rewrites each cut so it starts on the floor earlier cuts left, in the order
 * they run (files in order, cuts in order within each). Only flat end mills
 * leave a flat floor, so only their cuts count as clearing; V-carves aren't
 * rebased.
 */
export function startOnClearedFloors(files: ObjectCut[][]): ClearedFloorsResult {
  const cleared = new ClearedMaterial();
  const cuts = files.flat();
  cuts.forEach((cut, order) => {
    if (cut.bit.type !== 'flat') return;
    clearedAreas(cut.plan, cut.bit.diameter / 2).forEach((area) =>
      cleared.add({ ...area, order, label: cut.label }),
    );
  });

  const notes: ClearedFloorsResult['notes'] = [];
  let order = 0;
  const rebased = files.map((file) =>
    file.map((cut) => {
      const here = order++;
      const floorOf = (unit: Unit) => cleared.floorUnder(unit, (a) => a.order < here).depth;
      const plan = rebase(cut.plan, cut.bit.diameter / 2, floorOf);
      const note = runsTooEarly(cut, here, cleared);
      if (note) notes.push({ cut, message: note });
      return plan === cut.plan ? cut : { ...cut, plan };
    }),
  );
  return { files: rebased, notes };
}

/** A note when a later cut would clear the top of this one, had this one run after it. */
function runsTooEarly(cut: ObjectCut, order: number, cleared: ClearedMaterial): string | null {
  const radius = cut.bit.diameter / 2;
  for (const { unit, depth } of unitsOf(cut.plan, radius)) {
    const before = cleared.floorUnder(unit, (a) => a.order < order).depth;
    const later = cleared.floorUnder(unit, (a) => a.order > order && a.depth < depth - EPS);
    if (later.by && later.depth > before + EPS) {
      return `runs before "${later.by}", which clears the top of it. Move it after that cut so it starts ${fmt(later.depth)} down instead of at the top.`;
    }
  }
  return null;
}

/** Pass depths still to cut below `floor`. Each is at most one pass deeper than the one before. */
const below = (depths: readonly number[], floor: number) => depths.filter((d) => d > floor + EPS);

const lastOf = (depths: readonly number[]) => depths[depths.length - 1] ?? 0;

const loopUnit = (path: Path, radius: number): Unit => ({
  bounds: grow(boundsOfPaths([path]), radius),
  sweep: lazy(() => sweepPaths([path], radius)),
});

const holeUnit = (p: Vec2, radius: number): Unit => ({
  bounds: grow(boundsOfPoints([p]), radius),
  sweep: lazy(() => sweepPaths([{ closed: false, points: [p] }], radius)),
});

type PocketPlan = Extract<CutPlan, { kind: 'pocket' }>;

/** Every ring and the finishing loops: the whole area the pocket clears. */
const pocketPaths = (plan: PocketPlan) => [
  ...plan.rings.levels.flat(),
  ...(plan.finish?.paths ?? []),
];

const pocketUnit = (plan: PocketPlan, radius: number): Unit => ({
  bounds: grow(boundsOfPaths(plan.rings.levels[0] ?? []), radius),
  sweep: lazy(() => sweepPaths(pocketPaths(plan), radius)),
});

/** The pieces of a plan that can each start on their own floor, with their full depth. */
function unitsOf(plan: CutPlan, radius: number): Array<{ unit: Unit; depth: number }> {
  switch (plan.kind) {
    case 'carve':
      return [];
    case 'loops':
      return plan.groups.flatMap((g) =>
        g.paths.map((path) => ({ unit: loopUnit(path, radius), depth: lastOf(g.depths) })),
      );
    case 'drill':
      return plan.holes.flatMap((h) =>
        h.points.map((p) => ({ unit: holeUnit(p, radius), depth: lastOf(h.depths) })),
      );
    case 'pocket':
      return [{ unit: pocketUnit(plan, radius), depth: lastOf(plan.depths) }];
  }
}

/** Splits items by the floor under each, dropping those already cut to full depth. */
function byFloor<T>(items: readonly T[], depth: number, floorOf: (item: T) => number) {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const floor = floorOf(item);
    if (floor >= depth - EPS) continue;
    groups.set(floor, [...(groups.get(floor) ?? []), item]);
  }
  return [...groups];
}

/** True when rebasing split, dropped or rewrote anything. */
const changed = <T>(before: readonly T[], after: readonly T[]) =>
  before.length !== after.length || before.some((item, i) => item !== after[i]);

function rebase(plan: CutPlan, radius: number, floorOf: (unit: Unit) => number): CutPlan {
  switch (plan.kind) {
    case 'carve':
      return plan;
    case 'loops': {
      const groups = plan.groups.flatMap((g) => rebaseLoops(g, radius, floorOf));
      return changed(plan.groups, groups) ? { kind: 'loops', groups } : plan;
    }
    case 'drill': {
      const holes = plan.holes.flatMap((hole): DrillParams[] =>
        byFloor(hole.points, lastOf(hole.depths), (p) => floorOf(holeUnit(p, radius))).map(
          ([floor, points]) =>
            floor <= EPS && points.length === hole.points.length
              ? hole
              : { points, depths: below(hole.depths, floor), floor },
        ),
      );
      return changed(plan.holes, holes) ? { kind: 'drill', holes } : plan;
    }
    case 'pocket': {
      const floor = floorOf(pocketUnit(plan, radius));
      if (floor <= EPS) return plan;
      const finish = plan.finish ? (rebaseLoops(plan.finish, radius, floorOf)[0] ?? null) : null;
      return { ...plan, depths: below(plan.depths, floor), floor, finish };
    }
  }
}

function rebaseLoops(
  group: CutLoopsParams,
  radius: number,
  floorOf: (unit: Unit) => number,
): CutLoopsParams[] {
  return byFloor(group.paths, lastOf(group.depths), (path) => floorOf(loopUnit(path, radius))).map(
    ([floor, paths]) =>
      floor <= EPS && paths.length === group.paths.length
        ? group
        : { ...group, paths, depths: below(group.depths, floor), floor },
  );
}

/** What a flat end mill's cut removes, at the depth it reaches everywhere in each area. */
function clearedAreas(plan: CutPlan, radius: number): Array<Omit<ClearedArea, 'order' | 'label'>> {
  switch (plan.kind) {
    case 'carve':
      return [];
    case 'loops':
      return plan.groups.map((group) => ({
        bounds: grow(boundsOfPaths(group.paths), radius),
        region: lazy(() => sweepPaths(group.paths, radius)),
        // Tabs leave material standing, so a tabbed cut only counts down to the tabs' top.
        depth: Math.min(lastOf(group.depths), group.tabs ? -group.tabs.z : Infinity),
      }));
    case 'drill':
      return plan.holes.map((hole) => ({
        bounds: grow(boundsOfPoints(hole.points), radius),
        region: lazy(() =>
          sweepPaths(
            hole.points.map((p) => ({ closed: false, points: [p] })),
            radius,
          ),
        ),
        depth: lastOf(hole.depths),
      }));
    case 'pocket': {
      const unit = pocketUnit(plan, radius);
      return [{ bounds: unit.bounds, region: unit.sweep, depth: lastOf(plan.depths) }];
    }
  }
}
